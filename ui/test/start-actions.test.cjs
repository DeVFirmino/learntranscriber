const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { createStartActions } = loadTs('src/features/home/start-actions.ts');

function fixture({ recording = false, quick = false, captureError = false } = {}) {
  const calls = [];
  const actions = createStartActions({
    ensureSession: async () => calls.push('session'),
    startFloatingSession: async () => calls.push('floating'),
    recording: () => recording,
    toggleListening: async () => calls.push('toggle'),
    captureScreen: async () => {
      calls.push('capture');
      if (captureError) throw new Error('Capture failed');
    },
    quickScreenshot: () => quick,
    attached: () => calls.push('attached'),
    focusQuestion: () => calls.push('focus'),
  });
  return { actions, calls };
}

test('Start opens the session in the floating bar and starts audio only when it is not already recording', async () => {
  const idle = fixture();
  await idle.actions.start();
  assert.deepEqual(idle.calls, ['floating', 'toggle']);
  const listening = fixture({ recording: true });
  await listening.actions.start();
  assert.deepEqual(listening.calls, ['floating']);
});

test('Capture only announces an attachment when quick analysis is off and capture succeeded', async () => {
  for (const quick of [false, true]) {
    const f = fixture({ quick });
    await f.actions.capture();
    assert.deepEqual(f.calls, quick ? ['capture'] : ['capture', 'attached']);
  }
  const failed = fixture({ captureError: true });
  await assert.rejects(failed.actions.capture(), /Capture failed/);
  assert.deepEqual(failed.calls, ['capture']);
});

test('Ask opens the session before focusing its question field', async () => {
  const f = fixture();
  await f.actions.ask();
  assert.deepEqual(f.calls, ['session', 'focus']);
});
