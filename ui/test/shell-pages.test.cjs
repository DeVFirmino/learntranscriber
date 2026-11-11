// A route shows its own page; every settings tab is the settings page, and anything else is Home.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { pageFor, NAV_PAGES } = loadTs('src/features/shell/shell-pages.ts');

test('the navigation pages and the open session show themselves', () => {
  for (const page of NAV_PAGES) assert.equal(pageFor(page), page);
  assert.equal(pageFor('session'), 'session');
  assert.equal(pageFor('assistants/choose'), 'assistants');
});

test('every settings route is the settings page, and an unknown route is Home', () => {
  assert.equal(pageFor('settings'), 'settings');
  assert.equal(pageFor('settings/api/openai'), 'settings');
  assert.equal(pageFor('settings/account'), 'settings');
  assert.equal(pageFor('nowhere'), 'home');
  assert.equal(pageFor(''), 'home');
  assert.equal(pageFor('sessions/extra'), 'home');
});

test('privacy stays a settings section and removed connection links land on Home', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(NAV_PAGES)), ['home', 'sessions', 'assistants', 'settings']);
  assert.equal(pageFor('privacy'), 'settings');
  assert.equal(pageFor('settings/mcp'), 'settings');
  assert.equal(pageFor('tools'), 'home');
  assert.equal(pageFor('connections/advanced'), 'home');
});
