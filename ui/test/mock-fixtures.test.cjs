// The preview's small pure pieces split out of its former shared module: the model catalog, the local models
// default state, input validation, and the session text transforms.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

const globals = { URL, structuredClone };
const plain = (value) => JSON.parse(JSON.stringify(value));

test('the model catalog lists each model once, with a sha256 and a kind', () => {
  const { CATALOG } = loadTs('src/bridge/mock/model-catalog.ts', globals);
  assert.ok(CATALOG.length > 0);
  assert.equal(new Set(CATALOG.map((item) => item.id)).size, CATALOG.length);
  for (const item of CATALOG) {
    assert.match(item.sha256, /^[0-9a-f]{64}$/);
    assert.ok(item.kind === 'whisper' || item.kind === 'llm');
  }
});

test('the local models default state starts empty with both runtimes stopped', () => {
  const { emptyLocal } = loadTs('src/bridge/mock/local-state-fixture.ts', globals);
  assert.deepEqual(plain(emptyLocal()), {
    models: [],
    binaries: {},
    operations: [],
    runtimes: {
      llm: { status: 'stopped', modelId: null, error: '' },
      whisper: { status: 'stopped', modelId: null, error: '' },
    },
  });
});

test('text rejects empty, overlong or non-string input and trims the rest', () => {
  const { text } = loadTs('src/bridge/mock/input-validation.ts', globals);
  assert.equal(text('  hello  ', 20), 'hello');
  assert.throws(() => text('', 20), /Enter valid text/);
  assert.throws(() => text('   ', 20), /Enter valid text/);
  assert.throws(() => text(42, 20), /Enter valid text/);
  assert.throws(() => text('x'.repeat(21), 20), /Enter valid text/);
});

test('validateEndpoint accepts HTTPS and local HTTP but rejects credentials and remote HTTP', () => {
  const { validateEndpoint } = loadTs('src/bridge/mock/input-validation.ts', globals);
  assert.equal(validateEndpoint('https://example.com/api/'), 'https://example.com/api');
  assert.equal(validateEndpoint('http://127.0.0.1:1234'), 'http://127.0.0.1:1234');
  assert.throws(() => validateEndpoint('not a url'), /valid provider endpoint/);
  assert.throws(() => validateEndpoint('http://example.com'), /Use HTTPS/);
  assert.throws(() => validateEndpoint('https://user:pass@example.com'), /credentials/);
});

test('summaryOf drops entries and context, and markdown renders the title, summary and conversation', () => {
  const { summaryOf, markdown } = loadTs('src/bridge/mock/session-text.ts', globals);
  const session = {
    id: 's1',
    title: 'Study session',
    started_at: '2026-01-01T00:00:00.000Z',
    ended_at: null,
    summary: 'A short recap',
    entries: [{ kind: 'transcript', speaker: 'ME', content: 'Hello', created_at: '2026-01-01T00:00:01.000Z' }],
    context: [{ source: 'Notes', content: 'Extra context' }],
  };
  const summary = summaryOf(session);
  assert.equal(summary.title, 'Study session');
  assert.equal('entries' in summary, false);
  assert.equal('context' in summary, false);
  const text = markdown(session);
  assert.match(text, /^# Study session/);
  assert.match(text, /## Summary\n\nA short recap/);
  assert.match(text, /\*\*ME\*\* · 2026-01-01T00:00:01\.000Z\n\nHello/);
  assert.match(text, /## Attached context\n\n### Notes\n\nExtra context/);
});
