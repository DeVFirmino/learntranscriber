const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { ManualInsight } = loadTs('src/features/workspace/manual-insight.ts');

function harness({ entries = [], captions = {}, settings = {}, permissions = {}, authorization = 'authorized' } = {}) {
  const state = {
    activeSessionId: 'live',
    settings: {
      onboardingAudioSource: 'computer',
      systemAudio: true,
      systemAudioSource: 'native',
      transcriptionProvider: 'apple',
      ...settings,
    },
    permissions: { microphone: 'granted', screen: 'granted', accessibility: false, ...permissions },
  };
  const calls = [];
  const hints = [];
  const hooks = {
    api: {
      state: async () => state,
      session: async (id) => {
        calls.push(['session', id]);
        return { entries };
      },
      speechCapabilities: async () => ({ authorization }),
    },
    generating: () => false,
    captions: () => captions,
    insight: async (transcript) => calls.push(['insight', transcript]),
    notice: (permission) => hints.push(permission),
  };
  const analysis = new ManualInsight();
  return { state, calls, hints, hooks, run: () => analysis.run(hooks) };
}

test('silence gives one calm hint and makes no inference request, even without Accessibility', async () => {
  const h = harness();
  await h.run();
  assert.deepEqual(h.calls, [['session', 'live']]);
  assert.deepEqual(h.hints, [undefined]);
});

test('each missing capture or speech permission names the first required permission', async () => {
  for (const [permission, input] of [
    ['microphone', { permissions: { microphone: 'denied', screen: 'denied' } }],
    ['screen', { permissions: { screen: 'not-determined' } }],
    ['speech', { authorization: 'denied' }],
    ['speech', { authorization: 'restricted' }],
    ['microphone', { settings: { onboardingAudioSource: '' }, permissions: { microphone: 'denied' } }],
  ]) {
    const h = harness(input);
    await h.run();
    assert.deepEqual(h.hints, [permission]);
    assert.equal(h.calls.length, 1);
  }
});

test('microphone-only and loopback capture do not require Screen Recording, and API transcription does not require Speech', async () => {
  for (const settings of [{ systemAudio: false }, { systemAudioSource: 'input-device' }]) {
    const h = harness({
      settings: { ...settings, transcriptionProvider: 'openai' },
      permissions: { screen: 'denied' },
      authorization: 'denied',
    });
    h.hooks.api.speechCapabilities = () => assert.fail('API transcription needs no Apple Speech permission read');
    await h.run();
    assert.deepEqual(h.hints, [undefined]);
  }
});

test('saved or provisional speech generates exactly once and bypasses empty-capture hints', async () => {
  for (const input of [
    { entries: [{ kind: 'transcript', content: 'Heard a sentence.' }] },
    { captions: { THEY: 'A question in progress?' } },
  ]) {
    const h = harness(input);
    await h.run();
    assert.equal(h.calls.filter(([action]) => action === 'insight').length, 1);
    assert.deepEqual(h.hints, []);
    assert.equal(h.calls[1][1], input.captions ? 'THEY: A question in progress?' : undefined);
  }
});

test('blank transcript entries and other session entries still count as silence', async () => {
  const h = harness({
    entries: [
      { kind: 'transcript', content: '  ' },
      { kind: 'assistant', content: 'An older answer' },
    ],
    captions: { ME: ' ' },
  });
  await h.run();
  assert.deepEqual(h.hints, [undefined]);
});

test('concurrent presses share the guard through asynchronous checks and the guard releases after a failure', async () => {
  const h = harness({ captions: { ME: 'Heard' } });
  let release;
  h.hooks.api.session = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const first = h.run();
  await Promise.resolve();
  await h.run();
  release({ entries: [] });
  await first;
  assert.equal(h.calls.length, 1);
  h.hooks.api.session = async () => {
    throw new Error('Unavailable');
  };
  await assert.rejects(h.run(), /Unavailable/);
  h.hooks.api.session = async () => ({ entries: [] });
  await h.run();
  assert.equal(h.calls.length, 2);
});

test('ending or replacing the listening session during preflight does not analyze or show a stale hint', async () => {
  const h = harness();
  h.hooks.api.session = async () => {
    h.state.activeSessionId = 'another';
    return { entries: [] };
  };
  await h.run();
  assert.deepEqual(h.hints, []);
  assert.deepEqual(h.calls, []);
});

test('a busy answer skips the request and an unavailable speech check does not claim permission was denied', async () => {
  const h = harness();
  h.hooks.generating = () => true;
  await h.run();
  assert.deepEqual(h.calls, []);
  h.hooks.generating = () => false;
  h.hooks.api.speechCapabilities = async () => {
    throw new Error('Not available');
  };
  await h.run();
  assert.deepEqual(h.hints, [undefined]);
});

test('changing sessions while speech authorization is loading cancels its permission hint', async () => {
  const h = harness();
  h.hooks.api.speechCapabilities = async () => {
    h.state.activeSessionId = 'another';
    return { authorization: 'denied' };
  };
  await h.run();
  assert.deepEqual(h.hints, []);
  assert.deepEqual(h.calls, [['session', 'live']]);
});
