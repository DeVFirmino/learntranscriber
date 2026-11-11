const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { PRESETS, PRESET_NAMES, autoTunedPreset, recommendedPreset, sameLaunch } = loadTs(
  'src/settings/local-presets.ts',
);
const gb = (value) => value * 1024 ** 3;

test('the recommendation follows memory on Apple silicon and stays Safe on Intel Macs or unknown machines', () => {
  assert.equal(recommendedPreset(undefined), 'safe');
  assert.equal(recommendedPreset({ platform: 'darwin', arch: 'arm64', totalMemoryBytes: 0 }), 'safe');
  assert.equal(recommendedPreset({ platform: 'darwin', arch: 'x64', totalMemoryBytes: gb(64) }), 'safe');
  assert.equal(recommendedPreset({ platform: 'darwin', arch: 'arm64', totalMemoryBytes: gb(8) }), 'safe');
  assert.equal(recommendedPreset({ platform: 'darwin', arch: 'arm64', totalMemoryBytes: gb(16) }), 'balanced');
  assert.equal(recommendedPreset({ platform: 'darwin', arch: 'arm64', totalMemoryBytes: gb(24) }), 'fast');
  assert.equal(recommendedPreset({ platform: 'win32', arch: 'x64', totalMemoryBytes: gb(32) }), 'fast');
});

test('an automatic tuning shows Safe; otherwise there is no override', () => {
  assert.equal(autoTunedPreset({ tuning: { autoTuned: true } }), 'safe');
  assert.equal(autoTunedPreset({ tuning: { autoTuned: false } }), null);
  assert.equal(autoTunedPreset({ tuning: null }), null);
  assert.equal(autoTunedPreset(undefined), null);
});

test('saved launch settings match a preset only when every launch value is equal', () => {
  assert.deepEqual([...PRESET_NAMES], ['safe', 'balanced', 'fast']);
  assert.equal(sameLaunch({ ...PRESETS.fast }, PRESETS.fast), true);
  assert.equal(sameLaunch({ ...PRESETS.fast, localWarmup: false }, PRESETS.fast), false);
  assert.equal(sameLaunch(undefined, PRESETS.safe), false);
});
