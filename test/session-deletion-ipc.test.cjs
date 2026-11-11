const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerSessionLifecycle } = require('../src/main/interface/ipc/session-lifecycle.cjs');

test('batch deletion validates the whole input before the use case and deduplicates normalized ids', () => {
  const handlers = {},
    calls = [];
  registerSessionLifecycle(
    (channel, handler) => {
      handlers[channel] = handler;
    },
    {
      deleteMany: (ids) => {
        calls.push(ids);
        return ids.length;
      },
    },
  );
  const run = (value) => handlers['sessions:delete-many']({}, value);
  for (const value of [null, 's1', {}, [], ['s1', ''], ['s1', 42], ['s1', 'x'.repeat(101)], Array(201).fill('s1')])
    assert.throws(() => run(value));
  assert.deepEqual(calls, []);
  assert.equal(run([' s1 ', 's1', 's2']), 2);
  assert.deepEqual(calls, [['s1', 's2']]);
});
