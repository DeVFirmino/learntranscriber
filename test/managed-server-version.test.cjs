const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { LocalModels } = require('../src/main/infrastructure/local/local-models.cjs');

const llmData = Buffer.from('GGUF fixture model bytes');
const whisperData = Buffer.alloc(8);
whisperData.writeUInt32LE(0x67676d6c);

function fakeChild() {
  const child = new EventEmitter();
  child.kill = () => queueMicrotask(() => child.emit('exit'));
  return child;
}

async function setup(t, { kind, version }) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lt-managed-version-'));
  const traces = [];
  const manager = new LocalModels(path.join(directory, 'models'), () => {}, {
    startTimeoutMs: 2000,
    execFile: async () => ({ stdout: '', stderr: version ? `version: ${version}\n` : 'unrecognised output\n' }),
    spawn: () => fakeChild(),
    // Only /props needs a real body; /health (llm) and / (whisper) just need to answer ok.
    fetch: async (url) =>
      String(url).endsWith('/props')
        ? new Response(JSON.stringify({ default_generation_settings: { n_ctx: 4096 }, total_slots: 1 }))
        : new Response('{"status":"ok"}'),
  });
  manager.trace = (message) => traces.push(message);
  t.after(async () => {
    await manager.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  const source = path.join(directory, `${kind}.model-source`);
  await fs.writeFile(source, kind === 'llm' ? llmData : whisperData);
  const model = await manager.importFile(kind, source);
  return { manager, model, traces, directory };
}

test('choosing a binary records its parsed version next to the path in the shared state', async (t) => {
  const { manager } = await setup(t, { kind: 'llm', version: '0.7.0 (build 11669, commit 620d2225c)' });
  await manager.setBinary('llm', process.execPath);
  assert.equal(manager.state().binaries.llm, require('node:fs').realpathSync(process.execPath));
  assert.equal(manager.state().binaryVersions.llm, '0.7.0 (build 11669, commit 620d2225c)');
  assert.equal(manager.state().binaryVersions.whisper, null, 'an unset runtime has no version yet');
});

test('starting llama-server re-captures its version and logs it by name, without a filesystem path', async (t) => {
  const { manager, model, traces } = await setup(t, { kind: 'llm', version: '1.2.3 (build 1, commit abc)' });
  await manager.setBinary('llm', process.execPath);
  await manager.start(model.id);
  assert.equal(manager.state().binaryVersions.llm, '1.2.3 (build 1, commit abc)');
  assert.ok(traces.some((line) => line === 'Started llama-server, version 1.2.3 (build 1, commit abc).'));
  assert.ok(
    traces.every((line) => !line.includes('/') && !line.includes(os.tmpdir())),
    'the trace names the runtime and version only, never a path',
  );
  await manager.stop('llm');
});

test('a whisper-server start that prints no recognisable version line records and logs "unknown"', async (t) => {
  const { manager, model, traces } = await setup(t, { kind: 'whisper', version: null });
  await manager.setBinary('whisper', process.execPath);
  await manager.start(model.id);
  assert.equal(manager.state().binaryVersions.whisper, 'unknown');
  assert.ok(traces.some((line) => line === 'Started whisper-server, version unknown.'));
  await manager.stop('whisper');
});
