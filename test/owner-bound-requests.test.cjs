const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abortsWithOwner } = require('../src/main/application/runtime/owner-bound-requests.cjs');
const { createRequestRegistry } = require('../src/main/application/runtime/requests.cjs');

test('only owner-bound modes of the destroyed window abort with it', () => {
  for (const mode of ['assistantBuilder', 'followUps'])
    assert.equal(abortsWithOwner({ owner: 7, mode }, 7), true, mode);
  for (const mode of ['chat', 'insight', 'screenInsight', 'memory', 'translation'])
    assert.equal(abortsWithOwner({ owner: 7, mode }, 7), false, mode);
  assert.equal(abortsWithOwner({ owner: 8, mode: 'followUps' }, 7), false);
});

test('the registry cancels owner-bound requests, a session, and everything else', async () => {
  const registry = createRequestRegistry({ timers: { setTimeout, clearTimeout } });
  const signals = {};
  const hold = (id, owner, sessionId, mode) =>
    registry.run({ id, owner, sessionId, mode, timeoutMs: 60000 }, (signal) => {
      signals[id] = signal;
      return new Promise((resolve) => signal.addEventListener('abort', resolve));
    });
  const running = [
    hold('a', 1, 's1', 'followUps'),
    hold('b', 1, 's1', 'chat'),
    hold('c', 2, 's2', 'assistantBuilder'),
    hold('d', 2, 's3', 'chat'),
  ];
  assert.equal(registry.pending(), 4);
  registry.cancelOwner(1);
  assert.deepEqual(
    Object.entries(signals).map(([id, signal]) => [id, signal.aborted]),
    [
      ['a', true],
      ['b', false],
      ['c', false],
      ['d', false],
    ],
  );
  registry.cancelSession('s2');
  assert.equal(signals.c.aborted, true);
  assert.equal(signals.d.aborted, false);
  registry.cancelAll();
  await Promise.all(running);
  assert.equal(registry.pending(), 0);
});
