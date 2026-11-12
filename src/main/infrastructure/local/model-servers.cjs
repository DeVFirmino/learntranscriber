const fs = require('node:fs');
const os = require('node:os');
const { modelKind, serverArgs } = require('../../domain/providers/local-server.cjs');
const {
  launchConfig,
  launchPreferences,
  tuningPlan,
  isAllocationFailure,
} = require('../../domain/providers/local-launch.cjs');
const { spawnServer, waitForServer, terminateServer } = require('./server-process.cjs');
const { writeApiKeyFile, removeApiKeyFile } = require('./server-auth.cjs');
const { captureVersion } = require('./runtime-version.cjs');

const RUNTIME_NAME = { llm: 'llama-server', whisper: 'whisper-server' };

// The language model's launch plan: its saved preferences over the settings, tuned down step by step if allowed.
function llmPlan(model, settings) {
  const preferences = launchPreferences(model.launchSettings || {});
  const chosen = { ...settings, ...preferences };
  const configured = preferences.localContextSize ? { ...model, contextSize: preferences.localContextSize } : model;
  return tuningPlan(launchConfig(configured, chosen, os.cpus().length), settings.localAutoTune !== false);
}

// LocalModels methods that start and stop the loopback servers: a start verifies the model files, waits for the
// server to answer and retries with smaller settings after a memory allocation failure.
const modelServers = {
  start(id, settings = {}) {
    return this.startOwned(id, settings, false);
  },
  startOwned(id, settings, automatic) {
    const model = this.catalog.models.find((m) => m.id === id);
    if (!model) return Promise.reject(new Error('Model not found.'));
    if (this.starts[model.kind])
      return Promise.reject(new Error('Stop the current server or wait for the current operation.'));
    const job = { controller: new AbortController(), automatic, waiters: 0 };
    this.starts[model.kind] = job;
    job.promise = this.startAttempt(id, settings, 0, job.controller.signal).finally(() => {
      if (this.starts[model.kind] === job) delete this.starts[model.kind];
    });
    return job.promise;
  },
  async startAttempt(id, settings, fallbackAttempt, signal, plan) {
    signal.throwIfAborted();
    const model = this.catalog.models.find((m) => m.id === id);
    if (!model) throw new Error('Model not found.');
    const type = model.kind;
    if (model.vision && !(model.projector && fs.existsSync(this.projectorPath(model))))
      throw new Error('This vision model needs its projector. Download the pair again.');
    if (this.runtimes[type]?.child || this.operations[type])
      throw new Error('Stop the current server or wait for the current operation.');
    const binary = this.catalog.binaries[type];
    if (!binary) throw new Error(`Choose a ${RUNTIME_NAME[type]} executable first.`);
    if (type === 'llm') plan ||= llmPlan(model, settings);
    const config = plan?.[fallbackAttempt];
    await this.verify(id);
    signal.throwIfAborted();
    const op = this.begin(type, 'starting');
    const startupSignal = AbortSignal.any([op.controller.signal, AbortSignal.timeout(this.startTimeoutMs)]);
    const runtime = {
      status: 'starting',
      modelId: id,
      controller: op.controller,
      cacheMode: settings.kvCacheMode || 'off',
      requestedContextSize: plan?.[0].contextSize || null,
      contextSize: null,
      launchConfig: config || null,
      tuning: config
        ? { base: plan[0], effective: config, attempts: fallbackAttempt + 1, autoTuned: fallbackAttempt > 0 }
        : null,
    };
    this.runtimes[type] = runtime;
    // Only llama-server takes an API key; whisper-server has no authentication option.
    const apiKey = type === 'llm' ? this.newApiKey() : null;
    try {
      const port = await this.freePort();
      op.controller.signal.throwIfAborted();
      runtime.base = `http://127.0.0.1:${port}`;
      const apiKeyFile = apiKey ? this.apiKeyFilePath(type) : null;
      if (apiKeyFile) await writeApiKeyFile(apiKeyFile, apiKey);
      runtime.apiKey = apiKey;
      const args = serverArgs({
        type,
        model,
        modelFile: this.modelPath(model),
        projectorFile: model.projector ? this.projectorPath(model) : null,
        apiKeyFile,
        port,
        config,
        settings,
      });
      spawnServer({ spawn: this.spawn, binary, args, runtime, onExit: () => this.emit() });
      const capacity = await waitForServer({
        fetch: this.fetch,
        runtime,
        type,
        config,
        signal: startupSignal,
        apiKey,
      });
      if (capacity !== null) runtime.contextSize = capacity;
      startupSignal.throwIfAborted();
      if (!runtime.child) throw new Error('The local server exited before becoming ready.');
      runtime.status = 'running';
      runtime.error = '';
      if (fallbackAttempt)
        runtime.fallbackNotice = `Memory allocation failed; started with adjusted settings (${runtime.contextSize.toLocaleString()} tokens per slot, ${config.gpuLayers} GPU layers, attempt ${fallbackAttempt + 1}).`;
      this.binaryVersions[type] = await captureVersion({ execFile: this.execFile, binary });
      (this.trace || console.info)(`Started ${RUNTIME_NAME[type]}, version ${this.binaryVersions[type]}.`);
      this.touch(type);
      return this.state();
    } catch (failure) {
      const error =
        startupSignal.aborted && !op.controller.signal.aborted
          ? new Error('Local server did not become ready before the startup deadline.')
          : failure;
      const allocationFailure =
        type === 'llm' && fallbackAttempt + 1 < plan.length && isAllocationFailure(runtime.stderr || '');
      const mayRetry = allocationFailure && !op.controller.signal.aborted && !signal.aborted;
      runtime.error = error.name === 'AbortError' ? 'Start cancelled.' : error.message;
      await this.stopRuntime(type, false);
      if (mayRetry) {
        delete this.operations[type];
        this.emit();
        await this.startAttempt(id, settings, fallbackAttempt + 1, signal, plan);
        this.emit();
        return this.state();
      }
      throw error;
    } finally {
      delete this.operations[type];
      this.emit();
    }
  },
  // Stop also cancels a start still verifying or launching, before any runtime exists.
  async stop(type) {
    return this.stopRuntime(type, true);
  },
  async stopRuntime(type, cancelStart) {
    modelKind(type);
    if (cancelStart) this.starts[type]?.controller.abort();
    const pending = this.operations[type];
    if (pending && ['verifying', 'starting'].includes(pending.phase)) pending.controller.abort();
    const runtime = this.runtimes[type];
    if (!runtime) return;
    runtime.controller.abort();
    clearTimeout(runtime.idle);
    if (runtime.child) {
      runtime.status = 'stopping';
      this.emit();
      await terminateServer(runtime);
    }
    runtime.status = 'stopped';
    // Covers both a clean stop and a failed start: startAttempt's catch calls this too, on the same runtime.
    if (type === 'llm') await removeApiKeyFile(this.apiKeyFilePath(type));
    this.emit();
  },
};

module.exports = { modelServers };
