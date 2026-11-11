const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { canonicalRoute, settingsSection, aiLocation } = loadTs('src/features/shell/navigation.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

test('existing links resolve to the sole configuration destination without losing provider details', () => {
  const links = {
    privacy: 'settings/privacy',
    'settings/shortcuts': 'settings/features/shortcuts',
    'settings/account': 'settings/general',
    'settings/api': 'settings/ai/sources',
    'settings/api/openai': 'settings/ai/sources/openai',
    'settings/api/local': 'settings/ai/sources/local',
    'settings/models': 'settings/ai/models',
  };
  for (const [oldLink, destination] of Object.entries(links)) {
    assert.equal(canonicalRoute(oldLink), destination);
    assert.equal(canonicalRoute(destination), destination);
  }
});

test('privacy, data and preferences have distinct settings sections', () => {
  assert.equal(settingsSection('privacy'), 'privacy');
  assert.equal(settingsSection('settings/account'), 'general');
  assert.equal(settingsSection('settings/data'), 'data');
  assert.equal(settingsSection('settings/shortcuts'), 'features');
});

test('unknown sections fall back safely without inventing a navigation destination', () => {
  assert.equal(canonicalRoute('settings/missing'), 'settings/general');
});

test('provider setup and model selection remain different locations within AI settings', () => {
  assert.deepEqual(plain(aiLocation('settings/ai/models')), { view: 'models', provider: null });
  assert.deepEqual(plain(aiLocation('settings/api/custom')), { view: 'sources', provider: 'custom' });
  assert.deepEqual(plain(aiLocation('settings/ai/sources/apple_speech')), {
    view: 'sources',
    provider: 'apple_speech',
  });
});
