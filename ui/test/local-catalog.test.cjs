const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { modelCatalogRows } = loadTs('src/settings/local-catalog.ts');
const { MODEL_CATALOG } = require('../../src/main/domain/providers/model-catalog.cjs');
const hash = (value) => value.repeat(64);
const catalog = [
  { id: 'current', kind: 'llm', name: 'Current', sha256: hash('a') },
  { id: 'old', kind: 'llm', name: 'Old', sha256: hash('b'), legacy: true },
  { id: 'whisper', kind: 'whisper', name: 'Speech', sha256: hash('c') },
];
const model = (id, extra) => ({ id, kind: 'llm', name: id, available: true, sha256: hash('d'), bytes: 123, ...extra });

test('fresh catalogs expose only the seven reference models and keep older choices out of the list', () => {
  const fresh = [...modelCatalogRows(MODEL_CATALOG, [], 'whisper'), ...modelCatalogRows(MODEL_CATALOG, [], 'llm')];
  assert.deepEqual(
    fresh.map((row) => row.entry.id),
    [
      'large-v3',
      'large-v3-turbo',
      'qwen2.5-0.5b',
      'qwen2.5-1.5b',
      'qwen3-vl-2b-instruct',
      'gemma-3-4b-it',
      'gemma-3-12b-it',
    ],
  );
  assert.equal(
    fresh.every((row) => !row.downloaded),
    true,
  );
  for (const { entry } of fresh) {
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.match(entry.url, /^https:\/\/huggingface\.co\/[^/]+\/[^/]+\/resolve\/[a-f0-9]{40}\//);
    if (entry.projector) assert.match(entry.projector.sha256, /^[a-f0-9]{64}$/);
  }
});

test('catalog ids find installed UUIDs and preserve the file identity for actions', () => {
  const installed = model('uuid-file', { catalogId: 'current', sha256: hash('e') });
  const rows = modelCatalogRows(catalog, [installed], 'llm');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].entry.id, 'current');
  assert.equal(rows[0].model.id, 'uuid-file');
  assert.equal(rows[0].downloaded, true);
});

test('older verified imports match by digest without creating a second catalog row', () => {
  const installed = model('older-uuid', { sha256: hash('a') });
  const rows = modelCatalogRows(catalog, [installed], 'llm');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].model.id, 'older-uuid');
  assert.equal(rows[0].downloaded, true);
});

test('installed legacy files and additional custom imports stay selectable exactly once', () => {
  const models = [
    model('legacy-uuid', { sha256: hash('b') }),
    model('custom-uuid', {}),
    model('second-custom-uuid', {}),
  ];
  const rows = modelCatalogRows(catalog, models, 'llm');
  assert.deepEqual(
    Array.from(rows, (row) => row.entry.id),
    ['current', 'old', 'custom-uuid', 'second-custom-uuid'],
  );
  assert.deepEqual(
    Array.from(
      rows.filter((row) => row.downloaded),
      (row) => row.model.id,
    ),
    ['legacy-uuid', 'custom-uuid', 'second-custom-uuid'],
  );
});

test('missing files and a different model kind cannot mark a catalog entry downloaded', () => {
  const models = [
    model('missing-current', { catalogId: 'current', available: false }),
    model('missing-legacy', { catalogId: 'old', available: false }),
    model('wrong-kind', { catalogId: 'current', kind: 'whisper' }),
  ];
  const rows = modelCatalogRows(catalog, models, 'llm');
  assert.deepEqual(
    Array.from(rows, (row) => [row.entry.id, row.downloaded]),
    [['current', false]],
  );
});
