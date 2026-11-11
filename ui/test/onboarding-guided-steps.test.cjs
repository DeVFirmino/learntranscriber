const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

const { permissionPlan } = loadTs('src/features/onboarding/permission-plan.ts');
const { levelBars } = loadTs('src/features/onboarding/level-bars.ts');
const { listeningDefaults } = loadTs('src/features/onboarding/listening-choices.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

test('permissions are asked in order: the first missing one is current and the rest wait', () => {
  const needs = ['microphone', 'screen', 'speech'];
  const plan = permissionPlan(needs, { microphone: true, screen: false, speech: false });
  assert.equal(plan.current, 'screen');
  assert.deepEqual(plain(plan.rows.map((row) => row.tone)), ['done', 'now', 'later']);
  assert.equal(permissionPlan(needs, { microphone: true, screen: true, speech: true }).current, null);
  assert.equal(permissionPlan([], {}).current, null);
});

test('the meter keeps a visible floor in silence and scales every bar with the level', () => {
  const silent = levelBars(0);
  const loud = levelBars(1);
  assert.equal(silent.length, loud.length);
  assert.ok(silent.every((height) => height === 12));
  assert.ok(loud.every((height, index) => height > silent[index] && height <= 100));
  assert.deepEqual(levelBars(4), loud);
  assert.deepEqual(levelBars(-1), silent);
});

test('the listening step chooses computer audio and Apple Speech only on its first visit', () => {
  assert.deepEqual(plain(listeningDefaults({ onboardingAudioSource: '' })), {
    onboardingAudioSource: 'computer',
    systemAudio: true,
    transcriptionProvider: 'apple',
  });
  assert.deepEqual(plain(listeningDefaults({ onboardingAudioSource: 'microphone' })), {});
});
