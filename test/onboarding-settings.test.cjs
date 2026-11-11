const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase, transaction } = require('../src/main/infrastructure/sqlite/database.cjs');
const { settingsRepository } = require('../src/main/infrastructure/sqlite/settings.cjs');

test('onboarding milestones persist independently without making configuration ready', (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const settings = settingsRepository({ db, transaction });
  const schemaVersion = db.prepare('PRAGMA user_version').get().user_version;
  const original = settings.read();
  for (const key of ['onboardingStarted', 'onboardingDemoSeen', 'onboardingCompleted'])
    assert.equal(original[key], false);
  assert.equal(original.onboardingAudioSource, '');
  settings.update({ onboardingStarted: true, onboardingDemoSeen: true, onboardingDismissed: true });
  const reopened = settingsRepository({ db, transaction }).read();
  assert.equal(reopened.onboardingDemoSeen, true);
  assert.equal(reopened.onboardingStarted, true);
  assert.equal(reopened.onboardingCompleted, false);
  assert.equal(reopened.onboardingAudioSource, '');
  assert.equal(reopened.assistantsChosen, false);
  assert.equal(reopened.systemAudio, false);
  assert.equal(reopened.provider, original.provider);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, schemaVersion);
});

test('source choice validates atomically and legacy dismissal does not invent milestones', (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  db.prepare('INSERT INTO settings VALUES (?, ?)').run('onboardingDismissed', 'true');
  const settings = settingsRepository({ db, transaction });
  assert.equal(settings.read().onboardingStarted, false);
  for (const onboardingAudioSource of ['microphone', 'computer', '']) {
    settings.update({ onboardingAudioSource });
    assert.equal(settingsRepository({ db, transaction }).read().onboardingAudioSource, onboardingAudioSource);
  }
  for (const onboardingAudioSource of ['browser', null, 1, true]) {
    assert.throws(() => settings.update({ onboardingCompleted: true, onboardingAudioSource }));
    assert.equal(settings.read().onboardingCompleted, false);
  }
  for (const key of ['onboardingStarted', 'onboardingDemoSeen', 'onboardingCompleted'])
    assert.throws(() => settings.update({ [key]: 'true' }));
});
