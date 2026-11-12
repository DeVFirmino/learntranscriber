const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { LocalModels } = require('../src/main/infrastructure/local/local-models.cjs');

const FIXED_KEY = 'k'.repeat(64);
const llmData = Buffer.from('GGUF fixture model bytes');
const whisperData = Buffer.alloc(8);
whisperData.writeUInt32LE(0x67676d6c);

// A child that never exits on its own; kill() resolves it, like a real process reacting to SIGTERM.
function fakeChild() {
  const child = new EventEmitter();
  child.kill = () => queueMicrotask(() => child.emit('exit'));
  return child;
}

async function setup(t, { kind, fetchHandlers, spawnBehavior = 'runs' } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lt-managed-auth-'));
  const calls = { spawn: null, fetch: [] };
  const manager = new LocalModels(path.join(directory, 'models'), () => {}, {
    startTimeoutMs: 2000,
    newApiKey: () => FIXED_KEY,
    spawn: (binary, args, options) => {
      calls.spawn = { binary, args, options };
      if (spawnBehavior === 'throws') throw new Error('spawn failed');
      return fakeChild();
    },
    fetch: async (url, options) => {
      calls.fetch.push({ url: String(url), options });
      return fetchHandlers(String(url));
    },
  });
  t.after(async () => {
    await manager.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  const source = path.join(directory, `${kind}.model-source`);
  await fs.writeFile(source, kind === 'llm' ? llmData : whisperData);
  const model = await manager.importFile(kind, source);
  await manager.setBinary(kind, process.execPath);
  return { manager, directory, model, calls };
}

test('a started llama-server gets a fresh key file, every startup request carries it, and the lease exposes it', async (t) => {
  const { manager, directory, model, calls } = await setup(t, {
    kind: 'llm',
    fetchHandlers: (url) =>
      url.endsWith('/health')
        ? new Response('{"status":"ok"}')
        : new Response(JSON.stringify({ default_generation_settings: { n_ctx: 4096 }, total_slots: 1 })),
  });
  await manager.start(model.id);
  const { args } = calls.spawn;
  assert.equal(args[args.indexOf('--api-key-file') + 1], path.join(directory, 'models', 'keys', 'llm.key'));
  assert.ok(!args.some((arg) => arg.includes(FIXED_KEY)), 'the key itself never reaches the argument list');
  const keyFile = args[args.indexOf('--api-key-file') + 1];
  assert.equal(await fs.readFile(keyFile, 'utf8'), FIXED_KEY);
  assert.equal((await fs.stat(keyFile)).mode & 0o777, 0o600);
  assert.equal((await fs.stat(path.dirname(keyFile))).mode & 0o777, 0o700);
  assert.ok(calls.fetch.length >= 2, 'health and props were both requested');
  assert.ok(
    calls.fetch.every((call) => call.options.headers.Authorization === `Bearer ${FIXED_KEY}`),
    'every startup request carried the per-launch key',
  );
  const lease = manager.acquire('llm');
  assert.equal(lease.apiKey, FIXED_KEY);
  lease.release();
  await manager.stop('llm');
  await assert.rejects(fs.access(keyFile), { code: 'ENOENT' }, 'the key file is removed once the server stops');
});

test('a server that fails to start still has its key file removed', async (t) => {
  const { manager, directory, model } = await setup(t, {
    kind: 'llm',
    fetchHandlers: () => new Response('{"status":"ok"}'),
    spawnBehavior: 'throws',
  });
  await assert.rejects(manager.start(model.id));
  const keyFile = path.join(directory, 'models', 'keys', 'llm.key');
  await assert.rejects(fs.access(keyFile), { code: 'ENOENT' });
});

test('a whisper-server launch takes no api key, no key file and no bearer header', async (t) => {
  const { manager, directory, model, calls } = await setup(t, {
    kind: 'whisper',
    fetchHandlers: () => new Response('{"status":"ok"}'),
  });
  await manager.start(model.id);
  assert.ok(!calls.spawn.args.includes('--api-key-file'));
  assert.ok(
    calls.fetch.every((call) => call.options.headers === undefined),
    'whisper requests carry no Authorization header',
  );
  await assert.rejects(fs.access(path.join(directory, 'models', 'keys', 'whisper.key')), { code: 'ENOENT' });
  const lease = manager.acquire('whisper');
  assert.equal(lease.apiKey, null);
  lease.release();
  await manager.stop('whisper');
});
