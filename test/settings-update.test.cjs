const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createActiveSession } = require('../src/main/application/runtime/active-session.cjs');
const { createSettingsUpdate } = require('../src/main/application/settings/update.cjs');
const { sessionMetadata } = require('../src/main/domain/sessions/rules.cjs');

function harness(t) {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const calls = [],
    active = createActiveSession();
  const update = createSettingsUpdate({
    settings: { update: (patch) => repos.settings.update(patch) },
    active,
    sessions: {
      updateModel: (id, metadata) => {
        calls.push('session-model');
        repos.sessions.updateModel(id, metadata);
      },
    },
    metadata: (settings) => sessionMetadata(settings, {}),
    effects: {
      privacy: () => calls.push('privacy'),
      shortcuts: () => calls.push('shortcuts'),
      cancelScreenInsights: () => calls.push('cancel-insights'),
      surfaceTheme: () => calls.push('surface'),
      speechLanguage: () => calls.push('speech-language'),
    },
    changed: () => calls.push('publish'),
    publicState: () => ({ settings: repos.settings.read() }),
  });
  return { repos, calls, active, update };
}

test('an invalid patch is rejected before any effect or publication', (t) => {
  const { calls, update } = harness(t);
  assert.throws(() => update.save({ overlayOpacity: 5 }));
  assert.deepEqual(calls, []);
});

test('a save naming the update check bookkeeping is refused before anything is written', (t) => {
  const { repos, calls, update } = harness(t);
  const before = repos.settings.read();
  for (const key of ['updatesLastCheckAt', 'updatesLastRelease', 'updatesSnoozedUntil', 'updatesSkippedTag'])
    assert.throws(() => update.save({ overlayOpacity: 0.8, [key]: 'x' }), /kept by the app/);
  assert.deepEqual(repos.settings.read(), before);
  assert.deepEqual(calls, []);
});

test('an unrelated patch only refreshes privacy and publishes', (t) => {
  const { repos, calls, update } = harness(t);
  repos.settings.update({ autoSelection: true, autoScreenInsights: true });
  update.save({ overlayOpacity: 0.8 });
  assert.deepEqual(calls, ['privacy', 'publish']);
});

test('a model change on a live session records the new model before the other effects', (t) => {
  const { repos, calls, active, update } = harness(t);
  repos.settings.update({ autoSelection: true, autoScreenInsights: true });
  const session = repos.sessions.create('Live', 'general');
  active.set(session.id);
  update.save({ provider: 'custom', model: 'fixture-model', customBaseUrl: 'http://127.0.0.1:1/v1' });
  assert.deepEqual(calls, ['session-model', 'privacy', 'publish']);
  assert.equal(repos.sessions.get(session.id).model, 'fixture-model');
});

test('display and theme changes run their effects in order', async (t) => {
  const { calls, update } = harness(t);
  update.save({ displayId: '2', surfaceTheme: 'light' });
  assert.deepEqual(calls, ['privacy', 'cancel-insights', 'surface', 'publish']);
});

test('a new Apple Speech language restarts live captions before the state is published', (t) => {
  const { calls, update } = harness(t);
  update.save({ appleSpeechLocale: 'auto' });
  assert.deepEqual(calls, ['privacy', 'cancel-insights', 'speech-language', 'publish']);
  calls.length = 0;
  update.save({ overlayOpacity: 0.7 });
  assert.equal(calls.includes('speech-language'), false);
});
