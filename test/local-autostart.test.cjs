const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { LocalModels } = require('../src/main/infrastructure/local/local-models.cjs');
const { DEFAULTS } = require('../src/main/domain/settings/defaults.cjs');
const { validateSettings } = require('../src/main/domain/settings/validate.cjs');

test('local autostart defaults on and accepts an explicit saved opt-out', () => {
  assert.equal(DEFAULTS.localAutoStart, true);
  assert.deepEqual(validateSettings({ localAutoStart: false }), { localAutoStart: false });
  assert.throws(() => validateSettings({ localAutoStart: 'false' }), /Invalid value/);
});

function gate() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function setup(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'local-autostart-'));
  const manager = new LocalModels(path.join(directory, 'models'));
  const source = path.join(directory, 'fixture.gguf');
  await fs.writeFile(source, 'GGUF fixture');
  const model = await manager.importFile('llm', source);
  const ready = gate();
  const launches = [];
  manager.startAttempt = async (id, settings, _attempt, signal) => {
    launches.push({ id, settings, signal });
    await ready.promise;
    signal.throwIfAborted();
    manager.runtimes.llm = { status: 'running', child: {}, modelId: id, base: 'http://127.0.0.1:9', contextSize: 2048 };
    return manager.state();
  };
  t.after(async () => {
    ready.resolve();
    for (const runtime of Object.values(manager.runtimes)) clearTimeout(runtime.idle);
    manager.runtimes = {};
    await manager.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  return { manager, model, ready, launches };
}

test('first request starts an imported model and concurrent callers acquire independent leases', async (t) => {
  const { manager, model, ready, launches } = await setup(t);
  const settings = { localContextSize: 2048 };
  const first = manager.acquireReady('llm', settings);
  const second = manager.acquireReady('llm', settings);
  assert.equal(launches.length, 1);
  assert.equal(launches[0].id, model.id);
  assert.equal(launches[0].settings, settings);
  ready.resolve();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.model, model.id);
  assert.equal(b.contextSize, 2048);
  assert.equal(manager.runtimes.llm.users, 2);
  a.release();
  a.release();
  assert.equal(manager.runtimes.llm.users, 1);
  b.release();
  assert.equal(manager.runtimes.llm.users, 0);
  const running = await manager.acquireReady('llm', { localAutoStart: false });
  assert.equal(launches.length, 1);
  running.release();
});

test('cancelling one caller leaves shared startup and the other request alive', async (t) => {
  const { manager, ready, launches } = await setup(t);
  const controller = new AbortController();
  const first = manager.acquireReady('llm', {}, controller.signal);
  const rejected = assert.rejects(first, { name: 'AbortError' });
  const second = manager.acquireReady('llm');
  controller.abort();
  await rejected;
  assert.equal(launches[0].signal.aborted, false);
  ready.resolve();
  const lease = await second;
  assert.equal(manager.runtimes.llm.users, 1);
  lease.release();
});

test('cancelling every automatic waiter aborts startup without acquiring a lease', async (t) => {
  const { manager, ready, launches } = await setup(t);
  const controller = new AbortController();
  const pending = manager.acquireReady('llm', {}, controller.signal);
  const settled = manager.starts.llm.promise;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(launches[0].signal.aborted, true);
  ready.resolve();
  await assert.rejects(settled, { name: 'AbortError' });
  assert.equal(manager.starts.llm, undefined);
  assert.equal(manager.state().runtimes.llm.status, 'stopped');
});

test('a cancelled request joining manual startup never cancels the manual operation', async (t) => {
  const { manager, model, ready, launches } = await setup(t);
  const manual = manager.start(model.id);
  await assert.rejects(manager.start(model.id), /Stop/);
  const controller = new AbortController();
  const pending = manager.acquireReady('llm', {}, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(launches[0].signal.aborted, false);
  ready.resolve();
  await manual;
  assert.equal(manager.state().runtimes.llm.status, 'running');
  assert.equal(manager.runtimes.llm.users || 0, 0);
});

test('missing models, disabled autostart and an already cancelled request never start a server', async (t) => {
  const { manager, model, launches } = await setup(t);
  await assert.rejects(manager.acquireReady('llm', { localAutoStart: false }), /Start the local/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(manager.acquireReady('llm', {}, controller.signal), { name: 'AbortError' });
  await fs.rm(manager.modelPath(model));
  await assert.rejects(manager.acquireReady('llm'), /Import a local model/);
  assert.equal(launches.length, 0);
});

test('a failed automatic start can be retried by a later request', async (t) => {
  const { manager, ready } = await setup(t);
  const start = manager.startAttempt;
  manager.startAttempt = async () => {
    throw new Error('Fixture startup failed');
  };
  await assert.rejects(manager.acquireReady('llm'), /Fixture startup failed/);
  assert.equal(manager.starts.llm, undefined);
  manager.startAttempt = start;
  ready.resolve();
  const lease = await manager.acquireReady('llm');
  assert.equal(lease.contextSize, 2048);
  lease.release();
});

test('explicit stop during verification prevents a cancelled startup from spawning', async (t) => {
  const { manager, model } = await setup(t);
  manager.startAttempt = LocalModels.prototype.startAttempt;
  manager.catalog.binaries.llm = process.execPath;
  const verifying = gate();
  let spawns = 0;
  manager.verify = () => verifying.promise;
  manager.spawn = () => {
    spawns++;
    throw new Error('Unexpected spawn');
  };
  const startup = manager.start(model.id);
  const rejection = assert.rejects(startup, { name: 'AbortError' });
  await manager.stop('llm');
  verifying.resolve(true);
  await rejection;
  assert.equal(spawns, 0);
  assert.equal(manager.starts.llm, undefined);
});
