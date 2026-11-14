const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createActiveSession } = require('../src/main/application/runtime/active-session.cjs');
const { composeAudio } = require('../src/main/composition/audio.cjs');
const { composeSessions } = require('../src/main/composition/sessions.cjs');
const { composeMemory } = require('../src/main/composition/memory.cjs');
const { composeChatGPT } = require('../src/main/composition/chatgpt.cjs');
const { composeLocalModels } = require('../src/main/composition/local-models.cjs');
const { composeAssistants } = require('../src/main/composition/assistants.cjs');
const { composeGeneration } = require('../src/main/composition/generation.cjs');
const { createLiveEngines } = require('../src/main/composition/live-engines.cjs');
const { composeWorkspaceState } = require('../src/main/composition/workspace-state.cjs');
const { composeWorkspace } = require('../src/main/composition/workspace.cjs');
const { composeDesktop } = require('../src/main/composition/desktop.cjs');
const { createContextWatchers } = require('../src/main/composition/context-watchers.cjs');
const { composeDesktopControls } = require('../src/main/composition/desktop-controls.cjs');

// A handle that records each channel and keeps its handler, for calling one with a fake trusted event.
function recordingHandle() {
  const handlers = new Map();
  const handle = (channel, fn) => {
    assert.equal(handlers.has(channel), false, `${channel} registered twice`);
    handlers.set(channel, fn);
  };
  return { handle, handlers, call: (channel, ...args) => handlers.get(channel)({ sender: { id: 7 } }, ...args) };
}
const stub = () => new Proxy({}, { get: () => () => {} });

test('the audio wiring registers capture, live, segment and speech channels, and no voice channels', async () => {
  const { handle, handlers } = recordingHandle();
  const leases = composeAudio({
    handle,
    active: { id: () => null },
    settings: () => ({}),
    entries: stub(),
    systemAudio: stub(),
    engines: {
      apple: stub(),
      whisper: stub(),
      realtime: stub(),
      gemini: stub(),
    },
    jobs: stub(),
    nativeSpeech: stub(),
    transcribe: async () => '',
    broadcast: () => {},
    changed: () => {},
  });
  assert.equal(typeof leases.ended, 'function');
  for (const channel of [
    'audio:native-start',
    'audio:output-acquire',
    'live:start',
    'audio:transcribe',
    'speech:assets',
  ])
    assert.ok(handlers.has(channel), channel);
  for (const channel of ['voice:start', 'local-voice:start']) assert.equal(handlers.has(channel), false, channel);
});

for (const autoInsights of [false, true]) {
  test(`session creation prepares AI guidance only after opting in: autoInsights=${autoInsights}`, async (t) => {
    const repositories = createRepositories(openDatabase(':memory:'));
    t.after(() => repositories.db.close());
    repositories.settings.update({ autoInsights });
    const { handle, handlers, call } = recordingHandle();
    const baselines = [],
      prepared = [];
    composeSessions({
      handle,
      repositories,
      active: createActiveSession(),
      metadata: () => ({}),
      requests: stub(),
      route: stub(),
      providers: stub(),
      outputLeases: stub(),
      appleSpeech: stub(),
      transcriptionJobs: stub(),
      screenInsights: { sessionStarted: (id) => baselines.push(id) },
      realtimePrompts: { prepare: async (input) => prepared.push(input) },
      isLiveNotch: () => false,
      changed: () => {},
    });
    for (const channel of ['sessions:create', 'sessions:end', 'sessions:page', 'ai:translate-entry', 'ai:follow-ups'])
      assert.ok(handlers.has(channel), channel);
    const session = await call('sessions:create', 'Planning');
    assert.deepEqual(baselines, [session.id]);
    assert.equal(prepared.length, Number(autoInsights));
  });
}

test('the memory wiring registers only dictation', (t) => {
  const repositories = createRepositories(openDatabase(':memory:'));
  t.after(() => repositories.db.close());
  const { handle, handlers } = recordingHandle();
  composeMemory({ handle, repositories, requests: stub(), transcribe: async () => '' });
  assert.deepEqual([...handlers.keys()], ['memory:transcribe']);
});

test('the ChatGPT wiring reads the sealed session and registers the account channels', async (t) => {
  const repositories = createRepositories(openDatabase(':memory:'));
  t.after(() => repositories.db.close());
  const { handle, handlers } = recordingHandle();
  const { auth, accounts } = composeChatGPT({
    handle,
    repositories,
    vault: { read: async () => '', write: async () => {} },
    requests: stub(),
    openExternal: async () => {},
    changed: () => {},
  });
  t.after(() => auth.close());
  assert.deepEqual(await accounts.refresh(), { accounts: [], activeId: null, pending: false });
  assert.deepEqual([...handlers.keys()].sort(), [
    'chatgpt:cancel',
    'chatgpt:login',
    'chatgpt:logout',
    'chatgpt:select',
  ]);
});

test('the local model wiring builds the runtimes and their installer and registers management', async (t) => {
  const { handle, handlers } = recordingHandle();
  const { models, installer } = await composeLocalModels({
    handle,
    directory: join(tmpdir(), 'learntranscriber-composition-test'),
    settings: () => ({}),
    providers: stub(),
    picker: stub(),
    broadcast: () => {},
  });
  t.after(() => {
    installer.close();
    return models.close();
  });
  assert.equal(handlers.size, 16);
  for (const channel of ['models:list', 'runtimes:install', 'local:start', 'local:stop'])
    assert.ok(handlers.has(channel), channel);
});

test('composing local models reaps a registry left by a crash before any start channel is registered', async (t) => {
  const directory = await fs.mkdtemp(join(tmpdir(), 'learntranscriber-reap-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const registryFile = join(directory, 'models', 'keys', 'running.json');
  await fs.mkdir(join(directory, 'models', 'keys'), { recursive: true });
  // No real pid is ever this large, so this entry is already "dead" for the real ps lookup composeLocalModels uses.
  await fs.writeFile(registryFile, JSON.stringify({ llm: { pid: 999999999, executable: '/no/such/binary', port: 1 } }));
  const { handle, handlers } = recordingHandle();
  const { models, installer } = await composeLocalModels({
    handle,
    directory: join(directory, 'models'),
    settings: () => ({}),
    providers: stub(),
    picker: stub(),
    broadcast: () => {},
  });
  t.after(() => {
    installer.close();
    return models.close();
  });
  await assert.rejects(
    fs.access(registryFile),
    { code: 'ENOENT' },
    'the stale registry is cleared before handlers exist',
  );
  assert.ok(handlers.has('local:start'));
});

test('the assistant wiring registers the library and builder channels', (t) => {
  const repositories = createRepositories(openDatabase(':memory:'));
  t.after(() => repositories.db.close());
  const { handle, handlers } = recordingHandle();
  composeAssistants({
    handle,
    repositories,
    providers: stub(),
    route: stub(),
    requests: stub(),
    clipboard: stub(),
    saveSettings: () => {},
    callers: { isMain: () => true },
    changed: () => {},
  });
  assert.deepEqual([...handlers.keys()].sort(), [
    'assistants:apply-builder-action',
    'assistants:build',
    'assistants:choose-built-ins',
    'assistants:delete',
    'assistants:export',
    'assistants:import',
    'assistants:save',
  ]);
});

test('the generation wiring builds without touching providers, models or windows', (t) => {
  const repositories = createRepositories(openDatabase(':memory:'));
  t.after(() => repositories.db.close());
  const untouched = (name) =>
    new Proxy({}, { get: (_target, key) => assert.fail(`${name}.${String(key)} read while composing`) });
  const generation = composeGeneration({
    repositories,
    active: createActiveSession(),
    requests: untouched('requests'),
    localModels: untouched('localModels'),
    notch: { state: untouched('notchState'), window: untouched('notchWindow'), expand: () => {} },
    compactor: untouched('compactor'),
    providers: untouched('providers'),
    realtimePrompts: untouched('realtimePrompts'),
    fanOut: { broadcast: () => {}, toSender: () => {}, overlayDelta: () => {}, answer: () => {}, finished: () => {} },
    changed: () => {},
  });
  assert.equal(typeof generation.run, 'function');
});

test('the live engines share one caption publisher', (t) => {
  const repositories = createRepositories(openDatabase(':memory:'));
  t.after(() => repositories.db.close());
  const sent = [],
    heard = [];
  const engines = createLiveEngines({
    repositories,
    localModels: stub(),
    vault: { read: () => '' },
    nativeSpeech: { executable: '/missing/apple-speech' },
    transcribe: async () => '',
    speech: { heard: (caption) => heard.push(caption.text) },
    fanOut: {
      broadcast: (channel, payload) => sent.push([channel, payload.text ?? payload]),
      toOwner: (owner, channel, payload) => sent.push([owner, channel, payload]),
    },
    changed: () => sent.push(['changed']),
  });
  assert.deepEqual(Object.keys(engines).sort(), ['apple', 'gemini', 'realtime', 'whisper']);
  assert.equal(engines.realtime.onCaption, engines.gemini.onCaption);
  assert.equal(engines.apple.onCaption, engines.gemini.onCaption);
  engines.gemini.onCaption({ speaker: 'ME', text: 'hello', final: true });
  assert.deepEqual(heard, ['hello']);
  assert.deepEqual(sent, [['live:caption', 'hello'], ['changed']]);
  engines.apple.onNotice('Streaming Apple Speech is unavailable for this language.');
  assert.deepEqual(sent.at(-1), ['integration:error', 'Streaming Apple Speech is unavailable for this language.']);
});

test('the workspace state reads the library, runtimes, windows and desktop into one snapshot', (t) => {
  const repositories = createRepositories(openDatabase(':memory:'));
  t.after(() => repositories.db.close());
  const state = composeWorkspaceState({
    repositories,
    credentials: { headerNames: () => ['X-Team'] },
    active: createActiveSession(),
    localModels: { state: () => ({ runtimes: {} }) },
    runtimeInstaller: { state: () => ({}) },
    chatgpt: { status: () => ({ accounts: [] }) },
    notch: {
      state: { expanded: () => false, status: () => ({}) },
      window: { open: () => false },
    },
    windows: { overlayExpanded: () => false, listening: () => ({ active: false }), barRows: () => ({}) },
    shortcuts: { status: { hide: true }, accelerator: () => 'CommandOrControl+B' },
    privacy: { status: () => ({ concealed: false }) },
    tray: { visible: () => true },
    desktop: { permissions: () => ({ microphone: 'granted' }) },
  });
  const snapshot = state.snapshot();
  assert.deepEqual(snapshot.customHeaderNames, ['X-Team']);
  assert.equal(snapshot.notch.visible, false);
  assert.equal(snapshot.privacy.menuBarIconVisible, true);
  assert.equal(snapshot.privacy.shortcuts.hide, 'CommandOrControl+B');
  assert.deepEqual(snapshot.permissions, { microphone: 'granted' });
  assert.ok(snapshot.shortcutDefinitions.find((item) => item.id === 'hide').registered);
  assert.ok(snapshot.modelCatalog.length > 0);
});

test('the workspace wiring registers the workspace, window and Notch channels', (t) => {
  const repositories = createRepositories(openDatabase(':memory:'));
  t.after(() => repositories.db.close());
  const { handle, handlers } = recordingHandle();
  composeWorkspace({
    handle,
    repositories,
    active: createActiveSession(),
    state: () => ({}),
    shortcuts: stub(),
    compactor: () => null,
    generate: async () => '',
    callers: stub(),
    quit: stub(),
    windows: stub(),
    privacy: () => stub(),
    notch: { state: stub(), window: stub() },
    saveSettings: () => {},
    changed: () => {},
  });
  for (const channel of ['workspace:state', 'shortcuts:dispatch', 'ai:generate', 'app:quit-ready'])
    assert.ok(handlers.has(channel), channel);
  assert.equal([...handlers.keys()].filter((channel) => channel.startsWith('notch:')).length, 5);
});

test('the desktop wiring registers capture, context, clipboard, permission and export channels', (t) => {
  const repositories = createRepositories(openDatabase(':memory:'));
  t.after(() => repositories.db.close());
  const { handle, handlers } = recordingHandle();
  composeDesktop({
    handle,
    broadcast: () => {},
    sessions: repositories.sessions,
    active: createActiveSession(),
    capture: stub(),
    screenshot: async () => null,
    nativeContext: stub(),
    desktop: stub(),
    electron: { dialog: stub(), BrowserWindow: stub() },
  });
  assert.equal(handlers.size, 16);
  for (const channel of ['sessions:export', 'context:selection', 'screen:capture', 'permissions:open', 'app:relaunch'])
    assert.ok(handlers.has(channel), channel);
});

test('a failed selection read turns automatic selection off and reports it', async () => {
  const log = [];
  const { selection, copy } = createContextWatchers({
    nativeContext: {
      selection: async () => {
        throw new Error('Accessibility permission is missing.');
      },
    },
    clipboard: stub(),
    insights: stub(),
    settings: { update: (patch) => log.push(patch) },
    changed: () => log.push('changed'),
    report: (message) => log.push(message),
  });
  selection.update('s1', true);
  for (let i = 0; i < 20 && log.length < 3; i++) await new Promise((resolve) => setImmediate(resolve));
  selection.close();
  copy.close();
  assert.deepEqual(log, [{ autoSelection: false }, 'changed', 'Accessibility permission is missing.']);
});

test('the menu bar and the hide-all shortcut toggle concealment the same way', () => {
  const log = [];
  let concealed = false;
  const privacy = {
    get concealed() {
      return concealed;
    },
    toggleConcealment: () => {
      concealed = !concealed;
      log.push(`concealed ${concealed}`);
    },
  };
  let menu;
  const { visibility, tray } = composeDesktopControls({
    electron: {
      Tray: function Tray() {
        return { on: () => {}, setToolTip: () => {}, setContextMenu: () => {}, isDestroyed: () => false };
      },
      Menu: { buildFromTemplate: (template) => (menu = template) },
      nativeImage: { createFromPath: () => ({ setTemplateImage: () => {} }) },
    },
    iconPath: '/assets/trayTemplate.png',
    privacy: () => privacy,
    windows: { fadePanel: () => {}, showMain: () => log.push('show'), toggleOverlay: () => {} },
    settings: () => ({ showMenuBarIcon: true, shortcuts: '{}' }),
    saveSettings: () => {},
    active: { id: () => null },
    nativeContext: stub(),
    shortcutStatus: { hide: true },
    suspended: () => false,
    broadcast: () => {},
    changed: () => log.push('changed'),
    quit: () => {},
  });
  tray.update();
  assert.equal(tray.visible(), true);
  menu.find((item) => item.label === 'Hide all windows').click();
  // Pressed while concealed, the shortcut restores at once.
  visibility.press();
  assert.deepEqual(log, ['concealed true', 'changed', 'concealed false', 'changed']);
});
