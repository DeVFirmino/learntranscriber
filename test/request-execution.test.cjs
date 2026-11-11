const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequestRegistry } = require('../src/main/application/runtime/requests.cjs');
const { createModelRoute } = require('../src/main/application/runtime/model-route.cjs');
const { createFollowUpSuggestions } = require('../src/main/application/sessions/follow-ups.cjs');
const { createIpcRegistrar } = require('../src/main/interface/ipc/register.cjs');
const { registerFollowUps } = require('../src/main/interface/ipc/follow-ups.cjs');

function harness({ source = () => {}, ask = async () => ['Next?'], provider = 'local' } = {}) {
  const map = new Map(),
    leases = { acquired: 0, released: 0 };
  const route = createModelRoute({
    acquireLocal: () => {
      leases.acquired++;
      return { contextSize: 4096, base: 'http://127.0.0.1:9', model: 'm', release: () => leases.released++ };
    },
  });
  const followUps = createFollowUpSuggestions({
    settings: () => ({ provider }),
    followUps: () => ({ source, ask }),
    route,
  });
  const handlers = new Map();
  const handle = createIpcRegistrar({
    ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) },
    trusted: () => {},
    accepts: () => true,
  });
  const state = { notch: false };
  registerFollowUps(handle, {
    requests: createRequestRegistry({ requests: map, timers: { setTimeout, clearTimeout } }),
    followUps,
    isLiveNotch: () => state.notch,
  });
  const call = (owner, channel, input) => handlers.get(channel)({ sender: { id: owner } }, input);
  return { map, leases, state, call };
}
const input = { requestId: 'r1', sessionId: 's1', entryId: 'e1' };

test('model route waits for asynchronous acquisition and releases a lease when startup cancellation wins', async () => {
  const controller = new AbortController();
  const settings = { provider: 'local', localContextSize: 2048 };
  let finish,
    released = 0,
    calls = 0;
  const route = createModelRoute({
    acquireLocal: (current, signal) => {
      assert.equal(current, settings);
      assert.equal(signal, controller.signal);
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const pending = route.run(
    settings,
    () => {
      calls++;
    },
    { signal: controller.signal },
  );
  controller.abort();
  finish({ release: () => released++ });
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(calls, 0);
  assert.equal(released, 1);
});

test('model route maps a ready asynchronous lease and releases it after provider failure', async () => {
  let released = 0;
  const route = createModelRoute({
    acquireLocal: async () => ({
      base: 'http://127.0.0.1:9',
      model: 'fixture',
      contextSize: 2048,
      vision: true,
      release: () => released++,
    }),
  });
  await assert.rejects(
    route.run(
      { provider: 'local' },
      (settings) => {
        assert.equal(settings.provider, 'custom');
        assert.equal(settings.managedLocal, true);
        assert.equal(settings.customBaseUrl, 'http://127.0.0.1:9/v1');
        assert.equal(settings.contextSize, 2048);
        assert.equal(settings.visionCapable, true);
        throw new Error('Fixture provider failure');
      },
      { vision: true },
    ),
    /Fixture provider failure/,
  );
  assert.equal(released, 1);
});

test('a successful request releases its lease and leaves no registry entry', async () => {
  const { map, leases, call } = harness();
  assert.deepEqual(await call(1, 'ai:follow-ups', input), { ok: true, value: ['Next?'] });
  assert.deepEqual(leases, { acquired: 1, released: 1 });
  assert.equal(map.size, 0);
});

test('an ineligible source fails before any lease and is cleaned up', async () => {
  const { map, leases, call } = harness({
    source: () => {
      throw new Error('Choose a finished answer.');
    },
  });
  assert.deepEqual(await call(1, 'ai:follow-ups', input), { ok: false, error: 'Choose a finished answer.' });
  assert.deepEqual(leases, { acquired: 0, released: 0 });
  assert.equal(map.size, 0);
});

test('a duplicate id is refused, and only the owning window can cancel', async () => {
  let release;
  const { map, leases, call } = harness({
    ask: (_settings, _input, signal) =>
      new Promise((resolve, reject) => {
        release = resolve;
        signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }),
  });
  const running = call(1, 'ai:follow-ups', input);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(await call(1, 'ai:follow-ups', input), { ok: false, error: 'Request ID already in use.' });
  await call(2, 'ai:cancel', 'r1');
  assert.equal(map.size, 1);
  await call(1, 'ai:cancel', 'r1');
  assert.deepEqual(await running, { ok: false, error: 'Request cancelled or timed out.' });
  assert.equal(map.size, 0);
  assert.deepEqual(leases, { acquired: 1, released: 1 });
  release?.();
});

test('a provider failure still releases the lease', async () => {
  const { map, leases, call } = harness({
    ask: async () => {
      throw new Error('Provider unavailable.');
    },
  });
  assert.deepEqual(await call(1, 'ai:follow-ups', input), { ok: false, error: 'Provider unavailable.' });
  assert.deepEqual(leases, { acquired: 1, released: 1 });
  assert.equal(map.size, 0);
});

test('older suggestions are refused outside the live Notch', async () => {
  const { state, call } = harness({ provider: 'openai' });
  assert.deepEqual(await call(1, 'ai:follow-ups', { ...input, historical: true }), {
    ok: false,
    error: 'Only the active Notch can request older suggestions.',
  });
  assert.deepEqual(await call(1, 'ai:follow-ups', { ...input, historical: 'yes' }), {
    ok: false,
    error: 'Invalid suggestion history request.',
  });
  state.notch = true;
  assert.equal((await call(1, 'ai:follow-ups', { ...input, historical: true })).ok, true);
});
