const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { randomBytes } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { modelKind } = require('../../domain/providers/local-server.cjs');
const { openCatalog, saveCatalog } = require('./model-catalog-file.cjs');
const { freePort } = require('./server-process.cjs');
const { modelFiles } = require('./model-files.cjs');
const { modelImports } = require('./model-imports.cjs');
const { modelSettings } = require('./model-settings.cjs');
const { modelServers } = require('./model-servers.cjs');
const { modelLeases } = require('./model-leases.cjs');

const RUNTIME_DEFAULTS = {
  status: 'stopped',
  modelId: null,
  cacheMode: 'off',
  contextSize: null,
  requestedContextSize: null,
  fallbackNotice: '',
  launchConfig: null,
  tuning: null,
  error: '',
};

/**
 * The managed local models: a catalog of verified model files in `directory` and one llama-server and one
 * whisper-server on loopback. Each kind runs one operation at a time (`operations`); `onChange` receives the public
 * state after every change. Its methods come from the model files, imports, settings, servers and leases modules.
 * `fetch`, `spawn`, `execFile`, `newApiKey` and `persist` stay replaceable properties.
 */
class LocalModels {
  constructor(directory, onChange = () => {}, options = {}) {
    this.directory = directory;
    this.onChange = onChange;
    this.fetch = options.fetch || fetch;
    this.spawn = options.spawn || spawn;
    this.freePort = options.freePort || freePort;
    this.execFile = options.execFile || promisify(execFile);
    // A fresh 32-byte key per llama-server launch, hex-encoded; never read inside domain or application.
    this.newApiKey = options.newApiKey || (() => randomBytes(32).toString('hex'));
    this.startTimeoutMs = options.startTimeoutMs ?? 60000;
    this.idleMs = options.idleMs ?? 10 * 60000;
    this.runtimes = {};
    this.operations = {};
    this.starts = {};
    this.binaryVersions = {};
    this.closed = false;
    ({ file: this.file, catalog: this.catalog } = openCatalog(directory));
  }
  persist() {
    saveCatalog(this.file, this.catalog);
  }
  state() {
    return {
      system: {
        platform: process.platform,
        arch: process.arch,
        totalMemoryBytes: os.totalmem(),
        freeMemoryBytes: os.freemem(),
        cpuCount: os.cpus().length,
      },
      models: this.catalog.models.map((m) => {
        const projectorAvailable = Boolean(m.projector && fs.existsSync(this.projectorPath(m)));
        return {
          ...m,
          available: fs.existsSync(this.modelPath(m)) && (!m.vision || projectorAvailable),
          projectorAvailable,
        };
      }),
      binaries: { ...this.catalog.binaries },
      binaryVersions: Object.fromEntries(['llm', 'whisper'].map((k) => [k, this.binaryVersions[k] || null])),
      operations: Object.entries(this.operations).map(([kind, o]) => ({
        kind,
        phase: o.phase,
        bytes: o.bytes,
        total: o.total,
      })),
      runtimes: Object.fromEntries(
        ['llm', 'whisper'].map((k) => [
          k,
          Object.fromEntries(
            Object.entries(RUNTIME_DEFAULTS).map(([key, fallback]) => [key, this.runtimes[k]?.[key] || fallback]),
          ),
        ]),
      ),
    };
  }
  emit() {
    if (!this.closed) this.onChange(this.state());
  }
  modelPath(model) {
    if (!/^[a-f0-9-]{36}$/.test(model.id)) throw new Error('Invalid model identity.');
    return path.join(this.directory, model.id + '.model');
  }
  projectorPath(model) {
    const digest = model.projector?.sha256;
    if (digest && !/^[a-f0-9]{64}$/.test(digest)) throw new Error('Invalid projector digest.');
    return path.join(this.directory, model.id + (digest ? '-' + digest : '') + '.mmproj');
  }
  // A private location for a server's per-launch API key file, under its own 0700 subdirectory.
  apiKeyFilePath(type) {
    modelKind(type);
    return path.join(this.directory, 'keys', `${type}.key`);
  }
  // The crash-recovery registry of managed servers actually running right now, beside the key files.
  runningServersFile() {
    return path.join(this.directory, 'keys', 'running.json');
  }
  runningSnapshot() {
    return Object.fromEntries(
      ['llm', 'whisper']
        .filter((type) => this.runtimes[type]?.child)
        .map((type) => {
          const runtime = this.runtimes[type];
          return [type, { pid: runtime.pid, executable: runtime.executable, port: runtime.port }];
        }),
    );
  }
  begin(type, phase) {
    modelKind(type);
    if (this.closed) throw new Error('Local models manager is closing.');
    if (this.operations[type]) throw new Error('Wait for the current operation or cancel it.');
    const operation = { controller: new AbortController(), phase, bytes: 0, total: 0 };
    this.operations[type] = operation;
    this.emit();
    return operation;
  }
  cancel(type) {
    modelKind(type);
    this.operations[type]?.controller.abort();
  }
  // Close aborts every operation and waits for them to finish, up to closeTimeoutMs; past that it reports
  // which operations it gave up on instead of returning as if they had stopped.
  async close() {
    this.closed = true;
    for (const op of Object.values(this.operations)) op.controller.abort();
    await Promise.all(['llm', 'whisper'].map((type) => this.stop(type)));
    const deadline = Date.now() + (this.closeTimeoutMs ?? 30000);
    while (Object.keys(this.operations).length && Date.now() < deadline) await delay(50);
    const left = Object.entries(this.operations).map(([type, op]) => `${type} ${op.phase}`);
    if (left.length) (this.log || console.error)(`Local model operations still running at quit: ${left.join(', ')}.`);
    return { pending: left };
  }
}
Object.assign(LocalModels.prototype, modelFiles, modelImports, modelSettings, modelServers, modelLeases);

module.exports = { LocalModels };
