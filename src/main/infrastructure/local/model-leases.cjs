const fs = require('node:fs');
const { modelKind } = require('../../domain/providers/local-server.cjs');

// LocalModels methods that lend running servers to requests: a lease keeps its server alive, an idle server stops
// after idleMs, and requests waiting for an automatic start share it but cancel only themselves.
const modelLeases = {
  touch(type) {
    const runtime = this.runtimes[type];
    if (!runtime) return;
    clearTimeout(runtime.idle);
    if (!this.idleMs) return;
    runtime.idle = setTimeout(() => {
      if (runtime.users) {
        this.touch(type);
        return;
      }
      void this.stop(type);
    }, this.idleMs);
    runtime.idle.unref?.();
  },
  acquire(type) {
    modelKind(type);
    const runtime = this.runtimes[type];
    if (runtime?.status !== 'running' || !runtime.child)
      throw new Error(`Start the local ${type === 'llm' ? 'LLM' : 'Whisper'} server in Settings → Local models.`);
    runtime.users = (runtime.users || 0) + 1;
    this.touch(type);
    let released = false;
    const model = this.catalog.models.find((item) => item.id === runtime.modelId);
    return {
      base: runtime.base,
      model: runtime.modelId,
      contextSize: runtime.contextSize,
      // Only a leased llama-server carries a key; whisper-server has no authentication option.
      apiKey: runtime.apiKey || null,
      vision: Boolean(model?.projector && fs.existsSync(this.projectorPath(model))),
      release: () => {
        if (released) return;
        released = true;
        runtime.users = Math.max(0, runtime.users - 1);
        this.touch(type);
      },
    };
  },
  // Concurrent requests share startup, but each owns its cancellation and eventual lease.
  async acquireReady(type, settings = {}, signal) {
    modelKind(type);
    signal?.throwIfAborted();
    if (this.closed) throw new Error('Local models manager is closing.');
    if (this.runtimes[type]?.status === 'running') return this.acquire(type);
    if (this.runtimes[type]?.status === 'stopping') throw new Error('Wait for the local server to stop.');
    let job = this.starts[type];
    if (!job) {
      if (settings.localAutoStart === false) return this.acquire(type);
      const available = this.state().models.filter((model) => model.kind === type && model.available);
      const model = available.find((item) => item.id === this.runtimes[type]?.modelId) || available[0];
      if (!model) throw new Error('Import a local model in Settings → Local models before using it.');
      this.startOwned(model.id, settings, true);
      job = this.starts[type];
    }
    job.waiters++;
    let onAbort;
    try {
      const cancelled = new Promise((_, reject) => {
        onAbort = () => reject(signal.reason);
        signal?.addEventListener('abort', onAbort, { once: true });
      });
      await Promise.race([job.promise, cancelled]);
      signal?.throwIfAborted();
      return this.acquire(type);
    } finally {
      signal?.removeEventListener('abort', onAbort);
      job.waiters--;
      if (!job.waiters && job.automatic && this.starts[type] === job && signal?.aborted) {
        job.controller.abort();
        this.cancel(type);
      }
    }
  },
};

module.exports = { modelLeases };
