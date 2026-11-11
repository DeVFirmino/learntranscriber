// Quitting stops the recording, retries what failed once and reports what is still unsent, whatever fails on the way.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { flushBeforeQuit } = loadTs('src/features/workspace/quit-flush.ts', { Promise });

function audio({ recording = false, stopping = false, failed = [], stop, retry } = {}) {
  const calls = [];
  return {
    calls,
    audio: {
      recording,
      stopping,
      failed,
      stop: async () => (calls.push('stop'), stop?.()),
      retry: async () => (calls.push('retry'), retry?.()),
    },
  };
}
const ready = () => {
  const reported = [];
  return { reported, api: { quitReady: async (input) => reported.push(input.discardedSegments) } };
};

test('an idle window without failed audio only reports that nothing is unsent', async () => {
  const { audio: idle, calls } = audio();
  const { api, reported } = ready();
  await flushBeforeQuit(idle, api);
  assert.deepEqual(calls, []);
  assert.deepEqual(reported, [0]);
});

test('a recording is stopped and its failed segments retried before quitting', async () => {
  const failed = ['segment'];
  const { audio: recording, calls } = audio({ recording: true, failed, retry: () => failed.splice(0) });
  const { api, reported } = ready();
  await flushBeforeQuit(recording, api);
  assert.deepEqual(calls, ['stop', 'retry']);
  assert.deepEqual(reported, [0]);
});

test('a stop or retry that fails still lets the window quit and reports what is left', async () => {
  const { audio: broken, calls } = audio({
    stopping: true,
    failed: ['a', 'b'],
    stop: () => {
      throw new Error('drain failed');
    },
    retry: () => {
      throw new Error('offline');
    },
  });
  const { api, reported } = ready();
  await flushBeforeQuit(broken, api);
  assert.deepEqual(calls, ['stop', 'retry']);
  assert.deepEqual(reported, [2]);
  await flushBeforeQuit(broken, {
    quitReady: async () => {
      throw new Error('gone');
    },
  });
});
