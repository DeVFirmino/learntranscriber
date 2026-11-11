const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase, transaction } = require('../src/main/infrastructure/sqlite/database.cjs');
const { settingsRepository } = require('../src/main/infrastructure/sqlite/settings.cjs');
const { validateSettings } = require('../src/main/domain/settings/validate.cjs');
const { validateEndpoint } = require('../src/main/domain/settings/endpoint.cjs');

function open() {
  const db = openDatabase(':memory:');
  return { db, settings: settingsRepository({ db, transaction }) };
}

test('workspace zoom defaults to 100 percent, persists, and validates whole ten-percent steps atomically', () => {
  const { db, settings } = open();
  try {
    assert.equal(settings.read().workspaceZoom, 100);
    for (const workspaceZoom of [70, 100, 120, 150]) {
      settings.update({ workspaceZoom });
      assert.equal(settingsRepository({ db, transaction }).read().workspaceZoom, workspaceZoom);
    }
    for (const workspaceZoom of [60, 160, 105, 120.5, NaN, Infinity, '120']) {
      assert.throws(() => settings.update({ hideDock: true, workspaceZoom }));
      assert.equal(settings.read().workspaceZoom, 150);
      assert.equal(settings.read().hideDock, false);
    }
  } finally {
    db.close();
  }
});

test('invalid settings and unknown keys cannot partially change configuration', () => {
  const { db, settings } = open();
  try {
    assert.throws(() => settings.update({ hideDock: true, overlayOpacity: NaN }), /Opacity/);
    assert.equal(settings.read().hideDock, false);
    assert.throws(() => validateSettings({ apiKey: 'not-a-real-key' }), /Unknown/);
    assert.throws(() => validateSettings(JSON.parse('{"__proto__":true}')), /Unknown/);
    assert.throws(() => validateSettings({ captureProtection: 'true' }), /Invalid/);
    assert.equal(validateSettings({ unifiedModalFontScale: 1.6 }).unifiedModalFontScale, 1.6);
    for (const value of [0.6, 1.7, 1.05, NaN])
      assert.throws(() => validateSettings({ unifiedModalFontScale: value }), /Floating font size/);
  } finally {
    db.close();
  }
});
test('provider endpoints reject credential-bearing URLs and plaintext remote hosts', () => {
  assert.equal(validateEndpoint('http://localhost:11434/v1/'), 'http://localhost:11434/v1');
  assert.equal(validateEndpoint('https://example.com/v1'), 'https://example.com/v1');
  for (const url of [
    'http://example.com/v1',
    'https://user:password@example.com',
    'file:///tmp/model',
    'https://example.com?key=value',
  ])
    assert.throws(() => validateEndpoint(url));
});
test('a failed settings write rolls back the keys written before it', () => {
  const { db, settings } = open();
  try {
    db.exec(
      "CREATE TRIGGER block_opacity BEFORE INSERT ON settings WHEN new.key='overlayOpacity' BEGIN SELECT RAISE(ABORT,'blocked'); END;",
    );
    assert.throws(() => settings.update({ hideDock: true, overlayOpacity: 0.7 }), /blocked/);
    assert.equal(settings.read().hideDock, false);
  } finally {
    db.close();
  }
});
test('Notch presentation settings default to opaque with follow-ups and validate their range', () => {
  const { db, settings } = open();
  try {
    assert.equal(settings.read().notchOpacity, 1);
    assert.equal(settings.read().notchFollowUps, true);
    settings.update({ notchOpacity: 0.45, notchFollowUps: false });
    assert.equal(settings.read().notchOpacity, 0.45);
    assert.equal(settings.read().notchFollowUps, false);
    for (const notchOpacity of [0.44, 1.01, NaN, Infinity])
      assert.throws(() => validateSettings({ notchOpacity }), /Notch opacity/);
    assert.throws(() => validateSettings({ notchFollowUps: 'false' }), /Invalid/);
  } finally {
    db.close();
  }
});
test('surface theme defaults to dark and accepts only dark or light', () => {
  const { db, settings } = open();
  try {
    assert.equal(settings.read().surfaceTheme, 'dark');
    settings.update({ surfaceTheme: 'light' });
    assert.equal(settings.read().surfaceTheme, 'light');
    for (const surfaceTheme of ['Light', 'system', '', 1]) assert.throws(() => validateSettings({ surfaceTheme }));
  } finally {
    db.close();
  }
});
test('interface language defaults to the system and accepts only supported locales', () => {
  const { db, settings } = open();
  try {
    assert.equal(settings.read().uiLanguage, '');
    settings.update({ uiLanguage: 'pt-BR' });
    assert.equal(settings.read().uiLanguage, 'pt-BR');
    for (const uiLanguage of ['pt', 'fr', 'PT-BR', 1]) assert.throws(() => validateSettings({ uiLanguage }));
  } finally {
    db.close();
  }
});
