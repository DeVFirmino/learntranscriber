const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequestRegistry } = require('../src/main/application/runtime/requests.cjs');

function fakeTimers() {
  const scheduled = new Map();
  let next = 0;
  return {
    scheduled,
    setTimeout: (run, ms) => {
      scheduled.set(++next, { run, ms });
      return next;
    },
    clearTimeout: (id) => scheduled.delete(id),
  };
}

test('a request is aborted when its timeout fires on the injected timers', async () => {
  const timers = fakeTimers();
  const registry = createRequestRegistry({ timers });
  let signal;
  const running = registry.run({ id: 'r1', owner: 1, sessionId: 's1', mode: 'chat', timeoutMs: 90000 }, (given) => {
    signal = given;
    return new Promise((resolve) => given.addEventListener('abort', () => resolve('aborted')));
  });
  assert.deepEqual(
    [...timers.scheduled.values()].map((task) => task.ms),
    [90000],
  );
  assert.equal(registry.pending(), 1);
  [...timers.scheduled.values()][0].run();
  assert.equal(await running, 'aborted');
  assert.equal(signal.aborted, true);
  assert.equal(signal.reason.name, 'TimeoutError');
  assert.equal(registry.pending(), 0);
  assert.equal(timers.scheduled.size, 0);
});

test('a request that ends on its own clears its timeout and frees its id', async () => {
  const timers = fakeTimers();
  const registry = createRequestRegistry({ timers });
  assert.equal(await registry.run({ id: 'r1', owner: 1, timeoutMs: 1000 }, async () => 'done'), 'done');
  assert.equal(timers.scheduled.size, 0);
  assert.equal(registry.has('r1'), false);
  await assert.rejects(
    Promise.all([
      registry.run({ id: 'r2', owner: 1, timeoutMs: 1000 }, () => new Promise(() => {})),
      registry.run({ id: 'r2', owner: 1, timeoutMs: 1000 }, async () => {}),
    ]),
    /Request ID already in use/,
  );
});
