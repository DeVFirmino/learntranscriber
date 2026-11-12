// A refused microphone request becomes a message that names what to change, in every place that opens the mic.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

const { microphoneFailure } = loadTs('src/audio/microphone-failure.ts', { Error });
const { en } = loadTs('src/locales/en.ts');
const failure = (name) => Object.assign(new Error('browser text'), { name });

test('a denied, missing or busy microphone gets a message that says what to do', () => {
  assert.match(microphoneFailure(failure('NotAllowedError')).message, /Privacy & Security → Microphone/);
  assert.match(microphoneFailure(failure('SecurityError')).message, /Privacy & Security → Microphone/);
  assert.match(microphoneFailure(failure('NotFoundError')).message, /not connected/);
  assert.match(microphoneFailure(failure('OverconstrainedError')).message, /not connected/);
  assert.match(microphoneFailure(failure('NotReadableError')).message, /in use or unavailable/);
});

test('any other failure is passed on unchanged', () => {
  const aborted = failure('AbortError');
  assert.equal(microphoneFailure(aborted), aborted);
  assert.equal(microphoneFailure('text'), 'text');
  assert.equal(microphoneFailure(undefined), undefined);
});

test('every message has a catalog entry, so it is shown in the interface language', () => {
  const known = new Set(
    Object.entries(en)
      .filter(([key]) => key.startsWith('error.'))
      .map(([, value]) => value),
  );
  for (const name of ['NotAllowedError', 'NotFoundError', 'NotReadableError'])
    assert.ok(known.has(microphoneFailure(failure(name)).message), name);
});
