const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { accent, formatBytes, infoOf, sameModel } = loadTs('src/settings/local-model-info.ts');

test('each model family keeps its own accent colour, and unknown names fall back to slate', () => {
  assert.equal(accent('whisper'), '#10A37F');
  assert.equal(accent('gemma-3-4b-it'), '#4285F4');
  assert.equal(accent('mistral-7b'), '#FF4D4D');
  assert.equal(accent('llava-1.6'), '#0866FF');
  assert.equal(accent('moondream2'), '#F97316');
  assert.equal(accent('qwen2.5-0.5b'), '#a855f7');
  assert.equal(accent('phi-3'), '#94A3B8');
});

test('sizes read in the largest unit up to GB, and nonsense sizes read as zero', () => {
  assert.equal(formatBytes(0), '0 Bytes');
  assert.equal(formatBytes(Number.NaN), '0 Bytes');
  assert.equal(formatBytes(-5), '0 Bytes');
  assert.equal(formatBytes(512), '512 Bytes');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(3 * 1024 ** 3), '3 GB');
  assert.equal(formatBytes(2 * 1024 ** 4), '2048 GB');
});

test('an installed model matches its catalog entry by catalog id or by file hash', () => {
  const entry = { id: 'gemma-3-4b-it', sha256: 'aaa' };
  assert.equal(sameModel({ id: 'uuid', catalogId: 'gemma-3-4b-it', sha256: 'zzz' }, entry), true);
  assert.equal(sameModel({ id: 'uuid', sha256: 'aaa' }, entry), true);
  assert.equal(sameModel({ id: 'uuid', sha256: 'zzz' }, entry), false);
});

test('built-in models use their known info card, including installs found through the catalog hash', () => {
  assert.equal(infoOf({ id: 'gemma-3-4b-it', name: 'x', kind: 'llm' }).name, 'Gemma 3 4B');
  const catalog = [{ id: 'large-v3', sha256: 'abc' }];
  const installed = infoOf({ id: 'uuid', name: 'Imported', kind: 'whisper', sha256: 'abc' }, catalog);
  assert.equal(installed.name, 'Whisper Large v3');
  assert.equal(installed.recommended, true);
});

test('other models split their name into a title and details, and only analysis models get a type', () => {
  const vision = infoOf({ id: 'own', name: 'My Model · Vision · 2 GB', kind: 'llm' });
  assert.equal(vision.name, 'My Model');
  assert.deepEqual([...vision.meta], ['2 GB']);
  assert.equal(vision.type, 'vision');
  assert.equal(infoOf({ id: 'own', name: 'Projected', kind: 'llm', projector: {} }).type, 'vision');
  assert.equal(infoOf({ id: 'own', name: 'Text · 1 GB', kind: 'llm' }).type, 'text');
  assert.equal(infoOf({ id: 'own', name: 'Speech · 1 GB', kind: 'whisper' }).type, undefined);
});
