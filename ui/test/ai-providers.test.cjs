const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { PROVIDER_IDS, providerFromSection } = loadTs('src/settings/ai-providers.ts');

test('a known provider section opens that provider page', () => {
  for (const id of PROVIDER_IDS) assert.equal(providerFromSection(id), id);
});

test('a missing, unknown or inherited section falls back to the provider grid', () => {
  for (const section of [null, '', 'foo', 'toString', 'OpenAI']) assert.equal(providerFromSection(section), null);
});
