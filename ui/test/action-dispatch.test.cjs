const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { dispatchAction, responseIndex } = loadTs('src/features/workspace/action-dispatch.ts');

function harness({ overlay = false, recording = false, quick = false } = {}) {
  const calls = [];
  const record =
    (name) =>
    (...args) =>
      calls.push([name, ...args]);
  const slow = (name) => async () => {
    await Promise.resolve();
    calls.push([name]);
  };
  const hooks = {
    overlay: () => overlay,
    floating: record('floating'),
    go: record('go'),
    capture: slow('capture'),
    quickScreenshot: () => quick,
    recording: () => recording,
    insightNow: slow('insightNow'),
    toggleListening: slow('toggleListening'),
    togglePause: slow('togglePause'),
    muteMicrophone: record('muteMicrophone'),
    ask: slow('ask'),
    scroll: record('scroll'),
    showResponse: record('showResponse'),
  };
  return { calls, run: (action) => dispatchAction(action, hooks) };
}

test('the floating assistant only opens its question box, captures into it, or closes it', async () => {
  const floating = harness({ overlay: true, recording: true });
  for (const action of ['ask', 'escape', 'capture', 'record', 'mic', 'openAiSources', 'scrollUp'])
    await floating.run(action);
  assert.deepEqual(floating.calls, [
    ['floating', 'floating-ask'],
    ['floating', 'floating-escape'],
    ['floating', 'floating-compose'],
    ['capture'],
  ]);
  const workspace = harness();
  await workspace.run('escape');
  assert.deepEqual(workspace.calls, []);
});

test('quick capture sends immediately without opening or focusing a question input', async () => {
  const floating = harness({ overlay: true, quick: true });
  await floating.run('capture');
  assert.deepEqual(floating.calls, [['capture']]);
});

test('settings and assistant actions open their page in the workspace', async () => {
  const h = harness();
  await h.run('openSettings');
  await h.run('openAiModels');
  await h.run('openAiSources');
  await h.run('openAudioSources');
  await h.run('openAssistants');
  assert.deepEqual(h.calls, [
    ['go', 'settings/general'],
    ['go', 'settings/ai/models/analysis'],
    ['go', 'settings/ai/sources'],
    ['go', 'settings/general'],
    ['go', 'assistants'],
  ]);
});

test('record asks for an insight while listening and starts listening otherwise, finishing before it returns', async () => {
  const idle = harness();
  await idle.run('record');
  await idle.run('mic');
  assert.deepEqual(idle.calls, [['toggleListening']]);
  const listening = harness({ recording: true });
  await listening.run('record');
  await listening.run('mic');
  await listening.run('toggleRecording');
  await listening.run('pauseRecording');
  await listening.run('capture');
  await listening.run('ask');
  assert.deepEqual(listening.calls, [
    ['insightNow'],
    ['muteMicrophone'],
    ['toggleListening'],
    ['togglePause'],
    ['capture'],
    ['ask'],
  ]);
});

test('scrolling and response navigation go up or down, and unknown actions do nothing', async () => {
  const h = harness();
  for (const action of ['scrollUp', 'scrollDown', 'previousResponse', 'nextResponse', 'unknown', 'toString'])
    await h.run(action);
  assert.deepEqual(h.calls, [
    ['scroll', -1],
    ['scroll', 1],
    ['showResponse', -1],
    ['showResponse', 1],
  ]);
});

test('the first previous shows the newest response, the first next the oldest, and both stop at the ends', () => {
  assert.equal(responseIndex(null, 4, -1), 3);
  assert.equal(responseIndex(null, 4, 1), 0);
  assert.equal(responseIndex(2, 4, -1), 1);
  assert.equal(responseIndex(0, 4, -1), 0);
  assert.equal(responseIndex(3, 4, 1), 3);
  assert.equal(responseIndex(null, 0, -1), 0);
  assert.equal(responseIndex(5, 2, -1), 1);
});

test('the panel analyzes an explicit live request once without starting a second recorder', async () => {
  const h = harness({ overlay: true, recording: false });
  await h.run('analyze');
  assert.deepEqual(h.calls, [['insightNow']]);
  const workspace = harness({ recording: true });
  await workspace.run('analyze');
  assert.deepEqual(workspace.calls, []);
});
