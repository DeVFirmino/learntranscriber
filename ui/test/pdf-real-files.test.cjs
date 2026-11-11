const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { extractPdfText } = require('../src/assistant-knowledge.ts');

// Real PDFs made by macOS (cupsfilter for text, sips for an image-only "scanned" page) read with the same
// pdf.js the app ships, through its Node build.
const fixture = (name) => new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures', name)));
const pdfjs = () => import('pdfjs-dist/legacy/build/pdf.mjs');

test('a real text PDF keeps its words and accents', async () => {
  const text = await extractPdfText(await pdfjs(), fixture('text.pdf'));
  assert.match(text, /Decision record/);
  assert.match(text, /bounded queue/);
  assert.match(text, /Ação: revisar o código/);
});

test('a real multi-page PDF is labelled by page', async () => {
  const text = await extractPdfText(await pdfjs(), fixture('multipage.pdf'));
  assert.match(text, /^\[Page 1\]\nPage one: architecture notes\./);
  assert.match(text, /\[Page 2\][\s\S]*Final page: ship on Friday\./);
});

test('a scanned image-only PDF is refused as needing OCR', async () => {
  await assert.rejects(
    extractPdfText(await pdfjs(), fixture('scanned.pdf')),
    /no extractable text\. Scanned PDFs need OCR/,
  );
});

test('a truncated PDF fails with a readable message', async () => {
  await assert.rejects(extractPdfText(await pdfjs(), fixture('truncated.pdf')), /This PDF could not be read/);
});
