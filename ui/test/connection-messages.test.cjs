// The main process's connection messages reach the interface in English; each one has a catalog entry so it is shown
// in the interface language.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { unreachableMessage, DROPPED_MESSAGE } = require('../../src/main/domain/shared/connection-failure.cjs');

const { en } = loadTs('src/locales/en.ts');

test('every connection message the providers raise is in the catalog', () => {
  const known = new Set(
    Object.entries(en)
      .filter(([key]) => key.startsWith('error.'))
      .map(([, value]) => value),
  );
  for (const message of [
    unreachableMessage('https://api.openai.com/v1/chat/completions'),
    unreachableMessage('http://127.0.0.1:8080/v1/chat/completions'),
    DROPPED_MESSAGE,
  ])
    assert.ok(known.has(message), message);
});
