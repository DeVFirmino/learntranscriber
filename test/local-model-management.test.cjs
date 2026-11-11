const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLocalModelManagement } = require('../src/main/application/local/manage.cjs');

function harness({ picked = null, installing = [] } = {}) {
  const calls = [];
  const models = {
    state: () => ({ calls: calls.length }),
    setBinary: async (...args) => calls.push(['binary', ...args]),
    importFile: async (...args) => calls.push(['import', ...args]),
    importProjector: async (...args) => calls.push(['projector', ...args]),
    download: async (model) => calls.push(['download', model.id]),
    start: (id) => {
      calls.push(['start', id]);
      return true;
    },
    acquire: () => ({ base: 'http://127.0.0.1:9', release: () => calls.push(['release']) }),
  };
  const local = createLocalModelManagement({
    models,
    installer: { state: () => installing, install: () => true, cancel: () => {} },
    catalog: [{ id: 'qwen' }],
    settings: () => ({ provider: 'local' }),
    picker: {
      pick: async (_owner, kind) => {
        calls.push(['pick', kind]);
        return picked;
      },
    },
    providers: {
      models: async (settings) => {
        calls.push(['models', settings.customBaseUrl]);
        return ['m'];
      },
    },
  });
  return { local, calls };
}

test('a cancelled dialog changes nothing', async () => {
  const { local, calls } = harness();
  await local.pickBinary({}, 'llm');
  await local.importModel({}, 'whisper');
  await local.importProjector({}, 'model-1');
  assert.deepEqual(calls, [
    ['pick', 'llmServer'],
    ['pick', 'whisperModel'],
    ['pick', 'projector'],
  ]);
});

test('a chosen file is applied to the right model type', async () => {
  const { local, calls } = harness({ picked: '/models/a.gguf' });
  await local.importModel({}, 'llm');
  assert.deepEqual(calls, [
    ['pick', 'llmModel'],
    ['import', 'llm', '/models/a.gguf'],
  ]);
});

test('invalid types and unknown catalog models are refused before any dialog or download', async () => {
  const { local, calls } = harness();
  await assert.rejects(local.pickBinary({}, 'tts'), /Invalid server type/);
  await assert.rejects(local.importModel({}, 'tts'), /Invalid model type/);
  await assert.rejects(local.downloadCatalog('missing'), /Choose a catalog model/);
  assert.deepEqual(calls, []);
});

test('a local server cannot start during a runtime installation', () => {
  const { local, calls } = harness({ installing: [{ kind: 'llm' }] });
  assert.throws(() => local.start('model-1'), /Wait for runtime installation/);
  assert.deepEqual(calls, []);
});

test('listing local models leases the server for the call only', async () => {
  const { local, calls } = harness();
  assert.deepEqual(await local.list(), ['m']);
  assert.deepEqual(calls, [['models', 'http://127.0.0.1:9/v1'], ['release']]);
});
