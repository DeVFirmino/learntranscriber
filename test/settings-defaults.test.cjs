const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { shortcutConfig } = require('../src/main/domain/settings/shortcuts.cjs');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { validateSettings } = require('../src/main/domain/settings/validate.cjs');
const { validateEndpoint } = require('../src/main/domain/settings/endpoint.cjs');

test('fresh profiles start with their built-in defaults', (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const settings = repos.settings.read();
  assert.deepEqual(
    {
      copyToPrompt: settings.copyToPrompt,
      autoInsights: settings.autoInsights,
      liveTranscription: settings.liveTranscription,
      provider: settings.provider,
      model: settings.model,
      autoCompact: settings.autoCompact,
      compactThreshold: settings.compactThreshold,
      transcriptionProvider: settings.transcriptionProvider,
      translationLanguage: settings.translationLanguage,
      quickScreenshot: settings.quickScreenshot,
      showMenuBarIcon: settings.showMenuBarIcon,
      customBaseUrl: settings.customBaseUrl,
      systemAudio: settings.systemAudio,
      appleSpeechLocale: settings.appleSpeechLocale,
    },
    {
      copyToPrompt: true,
      autoInsights: false,
      liveTranscription: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      autoCompact: true,
      compactThreshold: 50000,
      transcriptionProvider: 'openai',
      translationLanguage: '',
      quickScreenshot: true,
      showMenuBarIcon: false,
      customBaseUrl: '',
      systemAudio: process.platform === 'win32',
      appleSpeechLocale: 'auto',
    },
  );
  // Each provider starts with its packaged model; a provider without one keeps asking for a model.
  repos.settings.update({ provider: 'gemini' });
  assert.equal(repos.settings.read().model, 'gemini-3.5-flash');
  repos.settings.update({ provider: 'openrouter' });
  assert.equal(repos.settings.read().model, '');
});

test('saved source, screenshot and menu-bar preferences survive a profile reopening', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-defaults-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'store.sqlite');
  const saved = {
    quickScreenshot: false,
    showMenuBarIcon: true,
    customBaseUrl: 'http://127.0.0.1:11434/v1',
    systemAudio: true,
    systemAudioSource: 'input-device',
    systemAudioInputDevice: 'existing-device',
    notchEnabled: false,
    workspaceZoom: 120,
  };
  const first = createRepositories(openDatabase(file));
  first.settings.update(saved);
  first.db.close();
  const reopened = createRepositories(openDatabase(file));
  t.after(() => reopened.db.close());
  for (const [key, value] of Object.entries(saved)) assert.deepEqual(reopened.settings.read()[key], value, key);
});

test('clearing the custom endpoint is valid configuration but cannot become a request endpoint', (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  repos.settings.update({ customBaseUrl: 'https://example.com/v1' });
  assert.deepEqual(validateSettings({ customBaseUrl: '' }), { customBaseUrl: '' });
  repos.settings.update({ customBaseUrl: '' });
  assert.equal(repos.settings.read().customBaseUrl, '');
  assert.throws(() => validateEndpoint(repos.settings.read().customBaseUrl), /valid provider endpoint/);
  assert.throws(() => repos.settings.update({ transcriptionBaseUrl: '' }), /valid provider endpoint/);
});

test('existing profiles keep every saved value, including saved old defaults and an empty model', (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const saved = {
    // The current user's explicit overrides.
    autoInsights: true,
    captureProtection: true,
    notchEnabled: false,
    stealthMode: true,
    transcriptionProvider: 'apple',
    // Values that equal the previous defaults but were saved.
    copyToPrompt: false,
    autoCompact: false,
    compactThreshold: 12000,
    translationLanguage: 'Portuguese (Brazil)',
    model: '',
    shortcuts: JSON.stringify({ hide: { accelerator: 'CommandOrControl+Shift+H', enabled: true } }),
  };
  repos.settings.update(saved);
  for (let i = 0; i < 2; i++) {
    const settings = repos.settings.read();
    for (const [key, value] of Object.entries(saved)) assert.deepEqual(settings[key], value, key);
  }
  const hide = shortcutConfig(repos.settings.read().shortcuts).find((item) => item.id === 'hide');
  assert.equal(hide.accelerator, 'CommandOrControl+Shift+H');
  // A key that was never saved adopts the new default.
  assert.equal(repos.settings.read().insightMode, 'proactive');
  assert.equal(repos.settings.read().launchFloating, true);
});

test('echo reduction starts off and accepts only a boolean', (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  assert.equal(repos.settings.read().echoReductionEnabled, false);
  assert.throws(() => validateSettings({ echoReductionEnabled: 'yes' }), /Invalid value for echoReductionEnabled/);
  repos.settings.update({ echoReductionEnabled: true });
  assert.equal(repos.settings.read().echoReductionEnabled, true);
});

test('the vocabulary hint accepts up to 2000 characters, as sent to local Whisper and cloud transcription', (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  repos.settings.update({ transcriptionPrompt: 'x'.repeat(2000) });
  assert.equal(repos.settings.read().transcriptionPrompt.length, 2000);
  assert.throws(() => repos.settings.update({ transcriptionPrompt: 'x'.repeat(2001) }), /too long/);
});
