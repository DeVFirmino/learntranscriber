const { test } = require('node:test');
const assert = require('node:assert/strict');
const { textFromItems, pdfTextFromPages } = require('../src/assistant-knowledge.ts');

test('PDF text chunks keep words, line breaks and nonempty page numbers', () => {
  const first = textFromItems([{ str: 'First' }, { str: 'page', hasEOL: true }, { str: 'line' }]);
  const third = textFromItems([{ str: 'Third' }, { str: 'page' }]);
  assert.equal(pdfTextFromPages([first, '', third]), '[Page 1]\nFirst page\nline\n\n[Page 3]\nThird page');
  assert.equal(pdfTextFromPages(['Only page']), 'Only page');
  assert.throws(() => pdfTextFromPages(['', '']), /no extractable text/);
});
