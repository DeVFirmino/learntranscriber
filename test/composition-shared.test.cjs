const { test } = require('node:test');
const assert = require('node:assert/strict');
const { composeRuntime } = require('../src/main/composition/runtime.cjs');
const { composeNative } = require('../src/main/composition/native.cjs');
const { composeProviders } = require('../src/main/composition/providers.cjs');
const { composeWindows } = require('../src/main/composition/windows.cjs');
const { composePublication } = require('../src/main/composition/publication.cjs');
const { composeSettings } = require('../src/main/composition/settings.cjs');
const { composeSystemEvents } = require('../src/main/composition/system-events.cjs');
const { composeScreenInsights } = require('../src/main/composition/screen-insights.cjs');
const { composeCompaction } = require('../src/main/composition/compaction.cjs');

// An engine that records what the quit sequence and a closing window ask of it.
function engine(name, calls) {
  return {
    drain: async () => calls.push(`${name} drained`),
    close: async () => calls.push(`${name} closed`),
    stop: async (owner, discard) => calls.push(`${name} stopped ${owner} ${discard}`),
  };
}
function engines(calls) {
  const names = ['whisper', 'realtime', 'gemini', 'apple'];
  return Object.fromEntries(names.map((name) => [name, engine(name, calls)]));
}

test('quitting drains every live engine after the recorded segments and closes every resource last', async () => {
  const calls = [];
  const live = engines(calls);
  const runtime = composeRuntime({
    live: () => live,
    localModels: () => ({ close: async () => calls.push('local models closed') }),
    systemAudio: () => ({ close: async () => calls.push('system audio closed') }),
    transcriptionJobs: { drainAll: async () => calls.push('segments drained') },
    mainWindow: () => null,
  });
  assert.equal(runtime.shutdown.accepts('ai:generate'), true);
  await runtime.shutdown.run();
  assert.equal(runtime.shutdown.accepts('ai:generate'), false);
  assert.deepEqual(calls, [
    'segments drained',
    'whisper drained',
    'realtime drained',
    'gemini drained',
    'apple drained',
    'local models closed',
    'system audio closed',
    'whisper closed',
    'realtime closed',
    'gemini closed',
    'apple closed',
  ]);
});

test('a destroyed window discards its live transcription; nothing runs before start', () => {
  const calls = [];
  let live = null;
  const runtime = composeRuntime({
    live: () => live,
    localModels: () => null,
    systemAudio: () => null,
    transcriptionJobs: {},
    mainWindow: () => null,
  });
  runtime.ownerCleanup.destroyed(7);
  assert.deepEqual(calls, []);
  live = engines(calls);
  runtime.ownerCleanup.destroyed(7);
  assert.deepEqual(calls.sort(), [
    'apple stopped 7 true',
    'gemini stopped 7 true',
    'realtime stopped 7 true',
    'whisper stopped 7 true',
  ]);
});

test('the native helpers run from the build folder in development, and the audio helper reaches the leases', () => {
  const broadcasts = [],
    leases = [];
  const native = composeNative({
    paths: { packaged: false, resourcesPath: '/Resources', root: '/repo' },
    db: () => null,
    active: { id: () => null },
    appleSpeech: () => null,
    broadcast: (channel, payload) => broadcasts.push([channel, payload]),
    outputLeases: () => ({
      ended: (message) => leases.push(['ended', message]),
      route: (change) => leases.push(['route', change.event]),
    }),
  });
  assert.equal(native.systemAudio.executable, '/repo/.local/native/system-audio');
  assert.equal(native.speech.executable, '/repo/.local/native/apple-speech');
  native.systemAudio.onError('The helper failed.');
  native.systemAudio.onExit({ unexpected: false });
  native.systemAudio.onExit({ unexpected: true });
  native.systemAudio.onRoute({ event: 'reconnecting' });
  assert.deepEqual(broadcasts, [['audio:native-error', 'The helper failed.']]);
  assert.deepEqual(leases, [
    ['ended', 'The incoming audio helper stopped.'],
    ['route', 'reconnecting'],
  ]);
  const packaged = composeNative({
    paths: { packaged: true, resourcesPath: '/Resources', root: '/repo' },
    db: () => null,
    active: {},
    appleSpeech: () => null,
    broadcast: () => {},
    outputLeases: () => null,
  });
  assert.equal(packaged.context.executable, '/Resources/native/context-helper');
});

test('provider keys are sealed in the stored credentials, and ChatGPT signs with its own token', async () => {
  const stored = new Map();
  let changes = 0;
  const { vault, providers } = composeProviders({
    credentials: () => ({
      get: (name) => stored.get(name),
      set: (name, value) => stored.set(name, value),
      status: () => [...stored.keys()],
    }),
    safeStorage: {
      isAsyncEncryptionAvailable: async () => true,
      encryptStringAsync: async (value) => Buffer.from(`sealed:${value}`),
      decryptStringAsync: async (value) => ({ result: value.toString().slice('sealed:'.length) }),
    },
    chatgptToken: async () => 'chatgpt-token',
    timers: { setTimeout: () => 1, clearTimeout() {} },
    changed: () => changes++,
  });
  await vault.write('openai', 'sk-test');
  assert.equal(stored.get('openai').toString(), 'sealed:sk-test');
  assert.equal(await providers.getKey('openai'), 'sk-test');
  assert.equal(await providers.getKey('chatgpt'), 'chatgpt-token');
  assert.deepEqual(vault.status(), ['openai']);
});

test('every window hears a broadcast, and a closing window hands its owner to the cleanup', () => {
  const sent = [],
    cleanup = [];
  const window = {
    isDestroyed: () => false,
    webContents: { send: (channel, payload) => sent.push([channel, payload]) },
  };
  const { broadcast, windows } = composeWindows({
    electron: { BrowserWindow: { getAllWindows: () => [window] }, screen: {} },
    ownerCleanup: {
      closing: (id) => cleanup.push(['closing', id]),
      destroyed: (id) => cleanup.push(['destroyed', id]),
    },
    privacy: () => ({ windows: new Set([window]) }),
    settings: () => ({}),
    active: { id: () => null },
    notchState: {},
    renderer: { path: '/index.html', url: 'file:///index.html' },
    preload: '/preload.cjs',
    isQuitting: () => false,
    changed: () => {},
    onSettingsOpen: () => {},
  });
  assert.equal(typeof windows.openMain, 'function');
  broadcast('workspace:changed', { ok: true });
  assert.deepEqual(sent, [['workspace:changed', { ok: true }]]);
});

test('a change settles the Notch and the bar, follows privacy and announces the new state', () => {
  const calls = [];
  let concealed = true;
  const publication = composePublication({
    active: { id: () => 's1' },
    privacy: () => ({ concealed }),
    settings: () => ({ copyToPrompt: true, autoSelection: false, insightMode: 'proactive' }),
    notchState: { prune: (context) => calls.push(['prune', context.concealed]) },
    windows: {
      syncNotch: () => calls.push(['notch']),
      syncBar: () => calls.push(['bar']),
      barVisible: () => true,
    },
    shortcuts: {
      registry: () => ({ setEscapeEnabled: (enabled) => calls.push(['escape', enabled]) }),
      visibility: () => ({ cancel: () => calls.push(['visibility cancelled']) }),
    },
    watchers: { copy: () => null, selection: () => ({ update: (id, enabled) => calls.push(['selection', enabled]) }) },
    screenInsights: { cancel: () => calls.push(['insights cancelled']) },
    tray: () => ({ update: () => calls.push(['tray']) }),
    workspaceState: () => ({ snapshot: () => 'state' }),
    broadcast: (channel, payload) => calls.push([channel, payload]),
  });
  publication.changed();
  assert.deepEqual(calls, [
    ['prune', true],
    ['notch'],
    ['bar'],
    ['escape', true],
    ['visibility cancelled'],
    ['insights cancelled'],
    ['selection', false],
    ['tray'],
    ['workspace:changed', 'state'],
  ]);
  calls.length = 0;
  concealed = false;
  publication.changed();
  assert.equal(
    calls.some(([name]) => name === 'visibility cancelled'),
    false,
  );
});

test('saving settings applies their effects, and a session model follows the settings and local runtimes', () => {
  const effects = [];
  const saved = {
    privacy: true,
    shortcuts: '{}',
    autoSelection: true,
    autoScreenInsights: true,
  };
  const { update, metadata } = composeSettings({
    repositories: () => ({
      settings: { read: () => ({ provider: 'local', model: 'saved-model' }), update: () => saved },
      sessions: { updateModel: () => {} },
    }),
    active: { id: () => null },
    localModels: () => ({ state: () => ({ runtimes: [] }) }),
    effects: {
      privacy: () => ({ update: () => effects.push('privacy') }),
      shortcuts: () => ({ configure: (value) => effects.push(`shortcuts ${value}`) }),
      screenInsights: { cancel: () => effects.push('insights cancelled') },
    },
    changed: () => effects.push('changed'),
    publicState: () => 'public',
  });
  assert.equal(update.save({ shortcuts: '{}' }), 'public');
  assert.deepEqual(effects, ['privacy', 'shortcuts {}', 'changed']);
  assert.equal(typeof metadata(), 'object');
});

test('a saved Apple Speech language switches the running live captions once the engines exist', () => {
  const switched = [];
  let engine = null;
  const { update } = composeSettings({
    repositories: () => ({
      settings: { read: () => ({}), update: () => ({ autoSelection: true, autoScreenInsights: true }) },
      sessions: { updateModel: () => {} },
    }),
    active: { id: () => null },
    localModels: () => null,
    effects: {
      privacy: () => ({ update: () => {} }),
      shortcuts: () => null,
      screenInsights: { cancel: () => {} },
      appleSpeech: () => engine,
    },
    changed: () => {},
    publicState: () => 'public',
  });
  assert.equal(update.save({ appleSpeechLocale: 'auto' }), 'public');
  engine = { switchLanguage: async () => switched.push('switched') };
  update.save({ appleSpeechLocale: 'pt-BR' });
  update.save({ overlayOpacity: 0.8 });
  assert.deepEqual(switched, ['switched']);
});

test('waking from sleep reapplies privacy, and display changes bring the windows back', () => {
  const listeners = {},
    calls = [];
  const on = (prefix) => ({ on: (event, listener) => (listeners[`${prefix}:${event}`] = listener) });
  composeSystemEvents({
    electron: { powerMonitor: on('power'), app: on('app'), screen: on('screen') },
    windows: {
      childGone: (details) => calls.push(['child gone', details.type]),
      recoverBounds: () => calls.push(['recover']),
    },
    privacy: { update: (settings) => calls.push(['privacy', settings.hideDock]) },
    settings: () => ({ hideDock: true }),
    changed: () => calls.push(['changed']),
  });
  listeners['power:resume']();
  listeners['app:child-process-gone']({}, { type: 'GPU' });
  listeners['screen:display-removed']();
  listeners['screen:display-metrics-changed']();
  assert.deepEqual(calls, [['privacy', true], ['changed'], ['child gone', 'GPU'], ['recover'], ['recover']]);
});

test('a copied selection is answered in the main window, unless someone is speaking or the windows are hidden', async () => {
  const asked = [];
  let speaking = false,
    concealed = false,
    main = { isDestroyed: () => false, webContents: { id: 1 } };
  const insights = composeScreenInsights({
    settings: () => ({ autoScreenInsights: false }),
    active: { id: () => 's1' },
    privacy: () => ({ concealed }),
    requests: { busy: () => false, cancelMode: () => {} },
    windows: { listening: () => ({ active: true }), main: () => main },
    liveSpeech: { speaking: () => speaking },
    screenshot: async () => '',
    broadcast: () => {},
    generate: async (event, input) => asked.push([event.sender.id, input.question]),
  });
  await insights.copied({ sessionId: 's1', text: 'selected' });
  speaking = true;
  await insights.copied({ sessionId: 's1', text: 'selected' });
  speaking = false;
  concealed = true;
  await insights.copied({ sessionId: 's1', text: 'selected' });
  concealed = false;
  main = null;
  await insights.copied({ sessionId: 's1', text: 'selected' });
  assert.deepEqual(asked, [[1, 'Explain the copied selection and give a useful next step.']]);
});

test('compaction builds the chat compactor and the live transcript compactor over the same providers', () => {
  const repositories = { sessions: {}, compactions: {}, transcriptMemory: {}, settings: { read: () => ({}) } };
  const { compactor, transcriptCompactor } = composeCompaction({
    repositories,
    active: { id: () => null },
    listening: () => ({ active: false }),
    route: {},
    providers: {},
    changed: () => {},
    report: () => {},
  });
  assert.equal(typeof compactor.compact, 'function');
  assert.equal(typeof transcriptCompactor.update, 'function');
  assert.equal(typeof transcriptCompactor.close, 'function');
});
