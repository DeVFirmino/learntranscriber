const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequestRegistry } = require('../src/main/application/runtime/requests.cjs');
const { createDictation } = require('../src/main/application/audio/dictate.cjs');
const { createIpcRegistrar } = require('../src/main/interface/ipc/register.cjs');
const { registerMemory } = require('../src/main/interface/ipc/memory.cjs');

function harness() {
  const handlers = new Map();
  const handle = createIpcRegistrar({
    ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) },
    trusted: () => {},
    accepts: () => true,
  });
  registerMemory(handle, {
    requests: createRequestRegistry({ requests: new Map(), timers: { setTimeout, clearTimeout } }),
    dictation: createDictation({
      settings: () => ({ transcriptionProvider: 'openai' }),
      transcribe: async () => ({ text: 'dictated' }),
    }),
  });
  const sender = { id: 1, isDestroyed: () => false, send() {} };
  const call = (channel, input) => handlers.get(channel)({ sender }, input);
  return { handlers, call };
}

test('only dictation is registered; history questions are gone', () => {
  assert.deepEqual([...harness().handlers.keys()], ['memory:transcribe']);
});

test('dictation accepts only a WAV segment under 2 MB', async () => {
  const { call } = harness();
  assert.deepEqual(
    await call('memory:transcribe', { requestId: 'd1', mime: 'audio/webm', bytes: new ArrayBuffer(4) }),
    { ok: false, error: 'Dictation requires a WAV segment under 2 MB.' },
  );
  assert.equal(
    (await call('memory:transcribe', { requestId: 'd1', mime: 'audio/wav', bytes: new ArrayBuffer(2000001) })).ok,
    false,
  );
  assert.deepEqual(await call('memory:transcribe', { requestId: 'd1', mime: 'audio/wav', bytes: new ArrayBuffer(4) }), {
    ok: true,
    value: { text: 'dictated' },
  });
});
