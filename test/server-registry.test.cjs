const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { LocalModels } = require('../src/main/infrastructure/local/local-models.cjs');

const llmData = Buffer.from('GGUF fixture model bytes');

function fakeChild() {
  const child = new EventEmitter();
  child.pid = 54321;
  child.kill = () => queueMicrotask(() => child.emit('exit'));
  return child;
}

async function setup(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lt-server-registry-'));
  const manager = new LocalModels(path.join(directory, 'models'), () => {}, {
    startTimeoutMs: 2000,
    execFile: async () => ({ stdout: '', stderr: '' }),
    spawn: () => fakeChild(),
    fetch: async (url) =>
      String(url).endsWith('/props')
        ? new Response(JSON.stringify({ default_generation_settings: { n_ctx: 4096 }, total_slots: 1 }))
        : new Response('{"status":"ok"}'),
  });
  manager.trace = () => {};
  t.after(async () => {
    await manager.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  const source = path.join(directory, 'model.gguf');
  await fs.writeFile(source, llmData);
  const model = await manager.importFile('llm', source);
  await manager.setBinary('llm', process.execPath);
  return { manager, model, directory, registryFile: manager.runningServersFile() };
}

test('starting a managed server records its pid, executable and port at mode 0600, and stopping clears it', async (t) => {
  const { manager, model, registryFile } = await setup(t);
  await manager.start(model.id);
  const saved = JSON.parse(await fs.readFile(registryFile, 'utf8'));
  assert.deepEqual(Object.keys(saved), ['llm']);
  assert.equal(saved.llm.pid, 54321);
  assert.equal(saved.llm.executable, require('node:fs').realpathSync(process.execPath));
  assert.equal(typeof saved.llm.port, 'number');
  assert.equal((await fs.stat(registryFile)).mode & 0o777, 0o600);
  assert.equal((await fs.stat(path.dirname(registryFile))).mode & 0o777, 0o700);
  await manager.stop('llm');
  assert.deepEqual(JSON.parse(await fs.readFile(registryFile, 'utf8')), {});
});

test('a server that fails to start leaves no registry entry behind', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lt-server-registry-'));
  const manager = new LocalModels(path.join(directory, 'models'), () => {}, {
    startTimeoutMs: 2000,
    spawn: () => {
      throw new Error('spawn failed');
    },
  });
  t.after(async () => {
    await manager.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  const source = path.join(directory, 'model.gguf');
  await fs.writeFile(source, llmData);
  const model = await manager.importFile('llm', source);
  await manager.setBinary('llm', process.execPath);
  await assert.rejects(manager.start(model.id));
  // stopRuntime's cleanup always saves the current snapshot; with nothing running, that snapshot is empty.
  assert.deepEqual(JSON.parse(await fs.readFile(manager.runningServersFile(), 'utf8')), {});
});
