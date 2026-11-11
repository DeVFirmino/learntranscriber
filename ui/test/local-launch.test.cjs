const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { savedLaunch, effectiveLaunch, shownLaunch, launchPreset, draftOf, launchOf, downloadedBytes } =
  loadTs('src/settings/local-launch.ts');
const { PRESETS } = loadTs('src/settings/local-presets.ts');

const plain = (value) => JSON.parse(JSON.stringify(value));
const model = (over = {}) => ({ id: 'm1', kind: 'llm', available: true, bytes: 100, contextSize: 8192, ...over });
const settings = { localContextSize: 4096 };

test('a model uses its own saved values, then its context size and the settings, then the safe preset', () => {
  assert.equal(savedLaunch(model({ launchSettings: {} })), undefined);
  assert.equal(savedLaunch(undefined), undefined);
  const saved = savedLaunch(model({ launchSettings: { localGpuLayers: 12 } }));
  assert.deepEqual(plain(effectiveLaunch(saved, model(), settings)), {
    localContextSize: 8192,
    localGpuLayers: 12,
    localBatchSize: PRESETS.safe.localBatchSize,
    localUbatchSize: PRESETS.safe.localUbatchSize,
    localParallel: PRESETS.safe.localParallel,
    localWarmup: PRESETS.safe.localWarmup,
  });
  assert.equal(effectiveLaunch(undefined, undefined, settings).localContextSize, 4096);
  assert.equal(effectiveLaunch({ localContextSize: 2048 }, model(), settings).localContextSize, 2048);
});

test('a running server shows the values it started with', () => {
  const effective = effectiveLaunch(undefined, model(), settings);
  assert.equal(shownLaunch(null, effective), effective);
  const config = { contextSize: 16384, gpuLayers: 99, batchSize: 512, ubatchSize: 256, parallel: 2, warmup: false };
  assert.deepEqual(plain(shownLaunch(config, effective)), {
    localContextSize: 16384,
    localGpuLayers: 99,
    localBatchSize: 512,
    localUbatchSize: 256,
    localParallel: 2,
    localWarmup: false,
  });
});

test('the preset is the one the saved values match, custom otherwise, then the tuned or recommended one', () => {
  const mac = { platform: 'darwin', arch: 'arm64', totalMemoryBytes: 64 * 1024 ** 3 };
  assert.equal(launchPreset({ ...PRESETS.balanced }, undefined, mac), 'balanced');
  assert.equal(launchPreset({ localGpuLayers: 7 }, undefined, mac), 'custom');
  assert.equal(launchPreset(undefined, { tuning: { autoTuned: true } }, mac), 'safe');
  assert.equal(launchPreset(undefined, undefined, mac), 'fast');
});

test('tuning fields are edited as text and saved as numbers', () => {
  const draft = draftOf(PRESETS.fast);
  assert.equal(typeof draft.ctxSize, 'string');
  assert.deepEqual(plain(launchOf(draft)), plain(PRESETS.fast));
  assert.equal(launchOf({ ...draft, parallel: '4' }).localParallel, 4);
});

test('downloaded space counts available models and the projectors already on disk', () => {
  assert.equal(
    downloadedBytes([
      model({ bytes: 100 }),
      model({ bytes: 50, available: false }),
      model({ bytes: 200, projectorAvailable: true, projector: { bytes: 30 } }),
      model({ bytes: 10, projectorAvailable: false, projector: { bytes: 99 } }),
    ]),
    340,
  );
});
