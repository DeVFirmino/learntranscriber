const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { HesitationMonitor } = loadTs('src/features/workspace/hesitation-monitor.ts');
const update = (monitor, now, extra = {}) =>
  monitor.update({ sessionId: 'session-1', text: 'um let me think', enabled: true, now, ...extra });

test('hesitation needs four seconds of current speech, one model decision and no heuristic fallback', async () => {
  const inputs = [];
  const monitor = new HesitationMonitor({
    newId: () => 'eval-1',
    cancel: async () => {},
    evaluate: async (input) => {
      inputs.push(input);
      return 'FLUENT';
    },
  });
  assert.equal(await update(monitor, 0), false);
  assert.equal(await update(monitor, 3999), false);
  assert.equal(inputs.length, 0);
  assert.equal(await update(monitor, 4000), false);
  assert.equal(await update(monitor, 5000), false);
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].mode, 'insightHesitation');
  assert.equal(inputs[0].liveTranscript, 'um let me think');
});

test('stopping speech cancels evaluation and a late result cannot relax a new session guard', async () => {
  let finish;
  const cancelled = [];
  const monitor = new HesitationMonitor({
    newId: () => 'eval-2',
    cancel: async (id) => cancelled.push(id),
    evaluate: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  await update(monitor, 0);
  const pending = update(monitor, 4000);
  assert.equal(await update(monitor, 4100), false, 'a pending request cannot launch another evaluation');
  await update(monitor, 4200, { text: '' });
  finish('HESITATING');
  assert.equal(await pending, false);
  assert.deepEqual(cancelled, ['eval-2']);
  assert.equal(await update(monitor, 5000, { sessionId: 'session-2' }), false);
});

test('a positive decision lasts only for uninterrupted supported speech and model failures preserve the guard', async () => {
  let calls = 0;
  const monitor = new HesitationMonitor({
    newId: () => 'eval-3',
    cancel: async () => {},
    evaluate: async () => {
      calls++;
      return 'HESITATING';
    },
  });
  await update(monitor, 0);
  assert.equal(await update(monitor, 4000), true);
  assert.equal(await update(monitor, 4500, { text: 'and now another fragment' }), true);
  assert.equal(calls, 1);
  assert.equal(await update(monitor, 5000, { enabled: false }), false);
  const failed = new HesitationMonitor({
    newId: () => 'eval-4',
    cancel: async () => {},
    evaluate: async () => {
      throw new Error('offline');
    },
  });
  await update(failed, 0);
  assert.equal(await update(failed, 4000), false);
});
