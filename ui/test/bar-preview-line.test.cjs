const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

const preview = loadTs('src/features/bar-preview-line.ts');
// Copied out of the module's VM context so strict deep equality compares plain objects.
const captions = (live) => ({ ...preview.previewCaptions(live) });
const next = (...args) => {
  const line = preview.nextPreviewLine(...args);
  return line && { ...line };
};

test('live captions reduce to the user and the other side, ignoring blank text', () => {
  assert.deepEqual(captions({ ME: ' hello ', THEY: '' }), { me: 'hello', them: '' });
  assert.deepEqual(captions({ THEY: 'question?' }), { me: '', them: 'question?' });
});

test('the caption that just changed is shown, the other side first', () => {
  const empty = { me: '', them: '' };
  const both = { me: 'I think', them: 'What about' };
  assert.deepEqual(next(empty, both, null), { speaker: 'them', text: 'What about' });
  assert.deepEqual(next(both, { ...both, me: 'I think so' }, null), { speaker: 'me', text: 'I think so' });
  // An unchanged caption keeps the line already shown; no live caption falls back to the saved transcript.
  const shown = { speaker: 'me', text: 'I think so' };
  assert.deepEqual(next(both, both, shown), shown);
  assert.equal(next(both, empty, shown), null);
});

test('a long line shows its newest words in one row', () => {
  assert.equal(preview.previewTail('  short  '), 'short');
  const long = 'a'.repeat(200) + ' newest words';
  const tail = preview.previewTail(long, 20);
  assert.ok(tail.startsWith('…'));
  assert.ok(tail.endsWith('newest words'));
  assert.equal(tail.length, 21);
});
