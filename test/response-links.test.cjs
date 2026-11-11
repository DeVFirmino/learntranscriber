const { test } = require('node:test');
const assert = require('node:assert/strict');
const { externalResponseUrl } = require('../src/main/domain/shared/response-links.cjs');
test('response links allow only explicit HTTP(S) destinations without credentials', () => {
  assert.equal(externalResponseUrl('https://example.com/docs'), 'https://example.com/docs');
  assert.equal(externalResponseUrl('http://localhost:8080/'), 'http://localhost:8080/');
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,hi',
    'file:///tmp/a',
    '/local',
    '#session',
    'https://person:secret@example.com',
    null,
    'x'.repeat(2049),
  ])
    assert.throws(() => externalResponseUrl(value));
});
