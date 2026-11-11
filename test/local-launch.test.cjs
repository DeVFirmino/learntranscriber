const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { LocalModels } = require('../src/main/infrastructure/local/local-models.cjs');
const { launchConfig, tuningPlan, launchArgs, BOUNDS } = require('../src/main/domain/providers/local-launch.cjs');
const { validateSettings } = require('../src/main/domain/settings/validate.cjs');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createLocalModelManagement } = require('../src/main/application/local/manage.cjs');

test('local launch defaults and bounds reach the documented process arguments', () => {
  const defaults = launchConfig({}, {}, 16);
  assert.deepEqual(defaults, {
    contextSize: 4096,
    gpuLayers: 0,
    batchSize: 256,
    ubatchSize: 64,
    parallel: 1,
    warmup: false,
    threads: 8,
  });
  assert.equal(launchConfig({}, {}, 1).threads, 1);
  assert.deepEqual(launchArgs(defaults), [
    '-c',
    '4096',
    '-t',
    '8',
    '--batch-size',
    '256',
    '--ubatch-size',
    '64',
    '--parallel',
    '1',
    '--no-warmup',
  ]);
  for (const [key, [min, max]] of Object.entries(BOUNDS)) {
    for (const value of [min, max]) assert.equal(validateSettings({ [key]: value })[key], value);
    for (const value of [min - 1, max + 1, NaN, 1.5, '2']) {
      assert.throws(() => validateSettings({ [key]: value }));
      assert.throws(() => launchConfig({}, { [key]: value }, 8));
    }
  }
});

test('memory tuning follows the deduplicated warmup GPU context and batch recovery order', () => {
  const base = launchConfig(
    {},
    { localContextSize: 8192, localGpuLayers: 99, localBatchSize: 2048, localUbatchSize: 512, localWarmup: true },
    8,
  );
  const plan = tuningPlan(base);
  assert.deepEqual(
    plan.map(({ contextSize, gpuLayers, batchSize, ubatchSize, warmup }) => [
      contextSize,
      gpuLayers,
      batchSize,
      ubatchSize,
      warmup,
    ]),
    [
      [8192, 99, 2048, 512, true],
      [8192, 99, 2048, 512, false],
      [8192, 10, 2048, 512, false],
      [8192, 0, 2048, 512, false],
      [4096, 10, 2048, 512, false],
      [4096, 0, 2048, 512, false],
      [2048, 0, 2048, 512, false],
      [2048, 0, 512, 128, false],
    ],
  );
  assert.deepEqual(tuningPlan(base, false), [base]);
  assert.deepEqual(
    tuningPlan(launchConfig({}, {}, 8)).map((config) => config.contextSize),
    [4096, 2048],
  );
  assert.equal(base.warmup, true);
  assert.equal(base.gpuLayers, 99);
});

test('saved startup options and an autostart opt-out survive a native store restart', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'launch-settings-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'store.sqlite');
  const patch = {
    localAutoStart: false,
    localWhisperGpu: false,
    localGpuLayers: 12,
    localBatchSize: 1024,
    localUbatchSize: 128,
    localParallel: 2,
    localWarmup: true,
    localAutoTune: false,
  };
  const first = createRepositories(openDatabase(file));
  first.settings.update(patch);
  first.db.close();
  const reopened = createRepositories(openDatabase(file));
  t.after(() => reopened.db.close());
  for (const [key, value] of Object.entries(patch)) assert.equal(reopened.settings.read()[key], value);
});

async function runtime(t, { fail = 0, message = 'out of memory', slots = 1, effective = 1024, ...options } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'launch-tuning-'));
  const calls = [];
  const manager = new LocalModels(path.join(directory, 'models'), () => {}, {
    freePort: async () => 12345,
    fetch: async (url) =>
      url.endsWith('/props')
        ? Response.json({ default_generation_settings: { n_ctx: effective }, total_slots: slots })
        : Response.json({ status: 'ok' }),
    spawn: (_binary, args) => {
      calls.push(args);
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = () => {
        queueMicrotask(() => child.emit('exit', 0));
        return true;
      };
      if (calls.length <= fail)
        queueMicrotask(() => {
          child.stderr.emit('data', Buffer.from(message));
          child.emit('exit', 1);
        });
      return child;
    },
    ...options,
  });
  t.after(async () => {
    await manager.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  const source = path.join(directory, 'fixture.gguf');
  await fs.writeFile(source, 'GGUF fixture');
  const model = await manager.importFile('llm', source);
  await manager.setBinary('llm', process.execPath);
  return { manager, model, calls };
}

test('allocation failures retry the process with the next configuration and report effective capacity without changing the saved model', async (t) => {
  const { manager, model, calls } = await runtime(t, { fail: 2, slots: 2, effective: 4096 });
  await manager.start(model.id, { localContextSize: 8192, localParallel: 2, localGpuLayers: 40, localWarmup: true });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].includes('--warmup'), true);
  assert.equal(calls[1].includes('--no-warmup'), true);
  assert.equal(calls[2][calls[2].indexOf('--gpu-layers') + 1], '10');
  const state = manager.state().runtimes.llm;
  assert.equal(state.status, 'running');
  assert.equal(state.requestedContextSize, 8192);
  assert.equal(state.contextSize, 4096);
  assert.equal(state.tuning.attempts, 3);
  assert.equal(state.tuning.autoTuned, true);
  assert.equal(state.launchConfig.gpuLayers, 10);
  assert.match(state.fallbackNotice, /attempt 3/);
  assert.equal(manager.catalog.models[0].contextSize, undefined);
  const lease = manager.acquire('llm');
  assert.equal(lease.contextSize, 4096);
  lease.release();
});

for (const message of ['insufficient memory', 'OutOfMemory', 'kIOGPUCommandBufferCallbackErrorOutOfMemory'])
  test(`startup recovers from ${message}`, async (t) => {
    const { manager, model, calls } = await runtime(t, { fail: 1, message });
    await manager.start(model.id, { localGpuLayers: 40 });
    assert.equal(calls.length, 2);
    assert.equal(calls[1][calls[1].indexOf('--gpu-layers') + 1], '10');
    assert.equal(manager.state().runtimes.llm.status, 'running');
  });

test('context recovery retries reduced GPU layers before returning to the server default', async (t) => {
  const { manager, model, calls } = await runtime(t, { fail: 3 });
  await manager.start(model.id, { localContextSize: 8192, localGpuLayers: 40 });
  assert.equal(calls.length, 4);
  assert.equal(calls[2].includes('--gpu-layers'), false);
  assert.equal(calls[3][calls[3].indexOf('-c') + 1], '4096');
  assert.equal(calls[3][calls[3].indexOf('--gpu-layers') + 1], '10');
});

for (const scenario of [
  { name: 'nonallocation startup failure', message: 'invalid model format', settings: {} },
  { name: 'disabled memory recovery', message: 'out of memory', settings: { localAutoTune: false } },
])
  test(scenario.name + ' never launches a fallback process', async (t) => {
    const { manager, model, calls } = await runtime(t, { fail: 10, message: scenario.message });
    await assert.rejects(manager.start(model.id, scenario.settings), /exited/);
    assert.equal(calls.length, 1);
    assert.equal(manager.state().runtimes.llm.status, 'stopped');
  });

test('parallel startup rejects a different slot count and releases the owned process', async (t) => {
  const { manager, model, calls } = await runtime(t, { slots: 1 });
  await assert.rejects(manager.start(model.id, { localParallel: 2 }), /configured slots/);
  assert.equal(calls.length, 1);
  assert.equal(manager.runtimes.llm.child, null);
});

test('the startup deadline cancels a health request and stops the owned child', async (t) => {
  const { manager, model, calls } = await runtime(t, {
    startTimeoutMs: 25,
    fetch: (_url, { signal }) =>
      new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error('Health request ignored cancellation')), 1000);
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(signal.reason);
          },
          { once: true },
        );
      }),
  });
  await assert.rejects(manager.start(model.id), /startup deadline/);
  assert.equal(calls.length, 1);
  assert.equal(manager.runtimes.llm.child, null);
  assert.match(manager.state().runtimes.llm.error, /startup deadline/);
});

test('launch preferences survive catalog restart and only affect their selected model', async (t) => {
  const { manager, model, calls } = await runtime(t);
  const second = await manager.importFile('llm', path.join(path.dirname(manager.directory), 'fixture.gguf'));
  const preferences = { localGpuLayers: 12, localBatchSize: 512, localUbatchSize: 128, localContextSize: 4096 };
  await manager.setLaunchSettings(model.id, preferences);
  const reopened = new LocalModels(manager.directory);
  t.after(() => reopened.close());
  assert.deepEqual(reopened.state().models.find((item) => item.id === model.id).launchSettings, preferences);
  assert.equal(reopened.state().models.find((item) => item.id === second.id).launchSettings, undefined);
  await manager.start(second.id, { localGpuLayers: 2 });
  assert.equal(calls[0][calls[0].indexOf('--gpu-layers') + 1], '2');
  await manager.stop('llm');
  await manager.start(model.id, { localGpuLayers: 2 });
  assert.equal(calls[1][calls[1].indexOf('--gpu-layers') + 1], '12');
  assert.equal(calls[1][calls[1].indexOf('--batch-size') + 1], '512');
  assert.equal(calls[1][calls[1].indexOf('--ubatch-size') + 1], '128');
});

test('saving and restarting applies model settings to the new owned process', async (t) => {
  const { manager, model, calls } = await runtime(t);
  await manager.start(model.id);
  const previous = manager.runtimes.llm.child;
  const oldLease = manager.acquire('llm');
  const result = await manager.setLaunchSettings(
    model.id,
    { localGpuLayers: 20, localWarmup: true, localContextSize: 8192 },
    { restart: true },
  );
  assert.equal(result.runtimes.llm.status, 'running');
  assert.equal(result.operations.length, 0);
  assert.notEqual(manager.runtimes.llm.child, previous);
  assert.equal(calls.length, 2);
  assert.equal(calls[1][calls[1].indexOf('-c') + 1], '8192');
  assert.equal(calls[1][calls[1].indexOf('--gpu-layers') + 1], '20');
  assert.equal(calls[1].includes('--warmup'), true);
  oldLease.release();
  assert.equal(manager.state().runtimes.llm.status, 'running');
});

test('invalid launch settings never change preferences or restart the running server', async (t) => {
  const { manager, model, calls } = await runtime(t);
  await manager.setLaunchSettings(model.id, { localGpuLayers: 11 });
  await manager.start(model.id);
  const child = manager.runtimes.llm.child;
  for (const invalid of [
    null,
    [],
    { localWarmup: 'false' },
    { localGpuLayers: 100 },
    { localContextSize: 511 },
    { command: '--unsafe' },
    { localAutoTune: false },
  ])
    await assert.rejects(manager.setLaunchSettings(model.id, invalid, { restart: true }));
  await assert.rejects(manager.setLaunchSettings(model.id, {}, { clear: 'true' }));
  assert.deepEqual(manager.state().models[0].launchSettings, { localGpuLayers: 11 });
  assert.equal(manager.runtimes.llm.child, child);
  assert.equal(calls.length, 1);
});

test('failed preference writes roll back saved tuning and legacy context without stopping the server', async (t) => {
  const { manager, model } = await runtime(t);
  await manager.setLaunchSettings(model.id, { localGpuLayers: 11 });
  manager.setContextSize(model.id, 2048);
  await manager.start(model.id);
  const child = manager.runtimes.llm.child;
  const persist = manager.persist;
  manager.persist = () => {
    throw new Error('Fixture disk failure');
  };
  await assert.rejects(manager.setLaunchSettings(model.id, {}, { clear: true, restart: true }), /disk failure/);
  await assert.rejects(manager.setLaunchSettings(model.id, { localGpuLayers: 20 }), /disk failure/);
  assert.equal(manager.runtimes.llm.child, child);
  assert.equal(manager.state().runtimes.llm.status, 'running');
  await manager.stop('llm');
  assert.throws(() => manager.setContextSize(model.id, 4096), /disk failure/);
  manager.persist = persist;
  assert.deepEqual(manager.state().models[0].launchSettings, { localGpuLayers: 11, localContextSize: 2048 });
  assert.equal(manager.state().models[0].contextSize, 2048);
  assert.equal(manager.state().operations.length, 0);
});

test('clearing model preferences restores global defaults and keeps other models intact', async (t) => {
  const { manager, model, calls } = await runtime(t);
  const other = await manager.importFile('llm', path.join(path.dirname(manager.directory), 'fixture.gguf'));
  await manager.setLaunchSettings(other.id, { localGpuLayers: 8 });
  await manager.setLaunchSettings(model.id, { localContextSize: 8192, localGpuLayers: 20 });
  manager.setContextSize(model.id, 4096);
  const settings = { localContextSize: 2048, localGpuLayers: 3 };
  await manager.setLaunchSettings(model.id, {}, { clear: true, restart: true, settings });
  const state = manager.state();
  assert.equal(state.models.find((item) => item.id === model.id).launchSettings, undefined);
  assert.equal(state.models.find((item) => item.id === model.id).contextSize, undefined);
  assert.deepEqual(state.models.find((item) => item.id === other.id).launchSettings, { localGpuLayers: 8 });
  assert.equal(calls[0][calls[0].indexOf('-c') + 1], '2048');
  assert.equal(calls[0][calls[0].indexOf('--gpu-layers') + 1], '3');
  assert.deepEqual(settings, { localContextSize: 2048, localGpuLayers: 3 });
});

test('a pending save-and-restart reserves the model lifecycle against another settings write', async (t) => {
  const { manager, model } = await runtime(t);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  t.after(() => release());
  const stop = manager.stop.bind(manager);
  manager.stop = async (type) => {
    await gate;
    return stop(type);
  };
  const pending = manager.setLaunchSettings(model.id, { localGpuLayers: 11 }, { restart: true });
  await assert.rejects(manager.setLaunchSettings(model.id, { localGpuLayers: 99 }), /current local model operation/);
  assert.throws(() => manager.setContextSize(model.id, 8192), /Stop/);
  release();
  await pending;
  assert.equal(manager.state().runtimes.llm.status, 'running');
  assert.equal(manager.state().models[0].launchSettings.localGpuLayers, 11);
});

test('a failed restart keeps the saved preference and a later start uses it', async (t) => {
  const { manager, model, calls } = await runtime(t, { fail: 1, message: 'invalid model format' });
  await assert.rejects(manager.setLaunchSettings(model.id, { localGpuLayers: 50 }, { restart: true }), /exited/);
  assert.equal(manager.state().runtimes.llm.status, 'stopped');
  assert.equal(manager.state().models[0].launchSettings.localGpuLayers, 50);
  await manager.start(model.id);
  assert.equal(calls.length, 2);
  assert.equal(calls[1][calls[1].indexOf('--gpu-layers') + 1], '50');
});

test('closing during Save and Restart cancels the pending launch without leaving an operation', async (t) => {
  const { manager, model, calls } = await runtime(t);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  t.after(() => release());
  const stop = manager.stop.bind(manager);
  manager.stop = async (type) => {
    await gate;
    return stop(type);
  };
  const pending = manager.setLaunchSettings(model.id, { localGpuLayers: 11 }, { restart: true });
  const cancelled = assert.rejects(pending, { name: 'AbortError' });
  const closing = manager.close();
  release();
  await cancelled;
  assert.deepEqual(await closing, { pending: [] });
  assert.equal(calls.length, 0);
  assert.equal(manager.state().operations.length, 0);
});

test('local management forwards per-model settings and blocks restart during installation', async () => {
  const calls = [];
  let installing = false;
  const current = { localContextSize: 2048 };
  const local = createLocalModelManagement({
    models: {
      setLaunchSettings: (...args) => {
        calls.push(args);
        return 'saved';
      },
    },
    installer: { state: () => (installing ? [{ kind: 'llm' }] : []) },
    settings: () => current,
  });
  assert.equal(local.setLaunchSettings({ id: 'model', settings: { localGpuLayers: 12 }, restart: true }), 'saved');
  assert.deepEqual(calls[0], ['model', { localGpuLayers: 12 }, { clear: false, restart: true, settings: current }]);
  installing = true;
  assert.throws(() => local.setLaunchSettings({ id: 'model', settings: {}, restart: true }), /runtime installation/);
  assert.equal(calls.length, 1);
});

test('Whisper GPU preference reaches the owned process without changing language-model tuning', async (t) => {
  const { manager, calls } = await runtime(t);
  const file = path.join(path.dirname(manager.directory), 'fixture-whisper.bin');
  const bytes = Buffer.alloc(8);
  bytes.writeUInt32LE(0x67676d6c);
  await fs.writeFile(file, bytes);
  const model = await manager.importFile('whisper', file);
  await manager.setBinary('whisper', process.execPath);
  await manager.start(model.id, { localWhisperGpu: false });
  assert.equal(calls[0].includes('--no-gpu'), true);
  assert.equal(calls[0].includes('--gpu-layers'), false);
  await manager.stop('whisper');
  await manager.start(model.id, { localWhisperGpu: true });
  assert.equal(calls[1].includes('--no-gpu'), false);
  assert.equal(manager.state().runtimes.whisper.status, 'running');
});
