const { test } = require('node:test');
const assert = require('node:assert/strict');
const { logLine } = require('../src/main/domain/shared/log-line.cjs');

const time = new Date('2026-11-03T12:00:00.000Z');

test('a log line carries the time, the level and the message', () => {
  assert.equal(
    logLine({ time, level: 'error', parts: ['Could not save', { id: 7 }] }),
    '2026-11-03T12:00:00.000Z ERROR Could not save {"id":7}\n',
  );
});

test('errors keep their stack, indented under the line', () => {
  const error = new Error('Provider failed');
  error.stack = 'Error: Provider failed\n    at call (provider.cjs:1:1)';
  assert.equal(
    logLine({ time, level: 'warn', parts: [error] }),
    '2026-11-03T12:00:00.000Z WARN Error: Provider failed\n        at call (provider.cjs:1:1)\n',
  );
});

test('anything shaped like a credential is redacted', () => {
  const line = logLine({
    time,
    level: 'error',
    parts: [
      'key sk-proj-abcdefghijklmnop',
      'google AIzaSyA1234567890abcdefghijklmn',
      'Authorization: Bearer abc.def-ghi',
      'jwt eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4',
      'https://host/v1?key=secret123&model=x',
    ],
  });
  for (const secret of ['abcdefghijklmnop', 'A1234567890', 'abc.def-ghi', 'SflKxwRJ', 'secret123'])
    assert.doesNotMatch(line, new RegExp(secret));
  assert.match(line, /model=x/);
});

test('long messages are cut so a transcript never lands whole on disk', () => {
  const line = logLine({ time, level: 'error', parts: ['x'.repeat(10000)] });
  assert.ok(line.length < 4100);
  assert.match(line, /… \[truncated\]\n$/);
});
