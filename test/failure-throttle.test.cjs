const { test } = require('node:test');
const assert = require('node:assert/strict');
const { throttleFailures } = require('../src/main/application/runtime/failure-throttle.cjs');

test('the same automatic failure is reported once a minute; a different one at once', () => {
  let now = 1000;
  const reported = [];
  const report = throttleFailures((message) => reported.push(message), { now: () => now });
  report('offline');
  now += 59999;
  report('offline');
  report('quota');
  report('offline');
  now += 60000;
  report('offline');
  assert.deepEqual(reported, ['offline', 'quota', 'offline', 'offline']);
});
