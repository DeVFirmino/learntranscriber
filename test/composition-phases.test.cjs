const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { composeCore } = require('../src/main/composition/core.cjs');
const { composeControls } = require('../src/main/composition/controls.cjs');
const { composeServices } = require('../src/main/composition/services.cjs');
const { registerControllers } = require('../src/main/composition/controllers.cjs');
const { startDesktop } = require('../src/main/composition/startup.cjs');
const { composeLifecycle } = require('../src/main/composition/lifecycle.cjs');

// An Electron whose app keeps its data in a temporary folder and whose other modules answer every call with nothing.
function fakeElectron(userData, log = []) {
  const quiet = (name) =>
    new Proxy(function () {}, {
      get: (_target, key) => () => log.push(`${name}.${String(key)}`),
      construct: () => ({}),
    });
  const channels = [];
  return {
    channels,
    log,
    electron: {
      app: {
        isPackaged: false,
        name: 'LearnTranscriber',
        getPath: (name) => join(userData, name),
        getAppPath: () => '/app',
        getVersion: () => '0.0.0-test',
        quit: () => log.push('app.quit'),
        on: () => {},
        dock: { hide() {}, show() {} },
      },
      ipcMain: { handle: (channel) => channels.push(channel) },
      BrowserWindow: { getAllWindows: () => [], fromWebContents: () => null },
      Menu: { buildFromTemplate: () => ({}), setApplicationMenu: () => {} },
      // The menu bar icon, built when a change asks for it.
      Tray: class {
        on() {}
        setToolTip() {}
        setContextMenu() {}
        isDestroyed() {
          return false;
        }
        destroy() {}
      },
      nativeImage: { createFromPath: () => ({ setTemplateImage() {} }) },
      globalShortcut: quiet('globalShortcut'),
      safeStorage: {
        isAsyncEncryptionAvailable: async () => true,
        encryptStringAsync: async (value) => Buffer.from(value),
        decryptStringAsync: async (value) => ({ result: value.toString() }),
      },
      screen: quiet('screen'),
      desktopCapturer: quiet('desktopCapturer'),
      session: { defaultSession: quiet('session') },
      systemPreferences: quiet('systemPreferences'),
      clipboard: quiet('clipboard'),
      dialog: quiet('dialog'),
      shell: quiet('shell'),
      powerMonitor: quiet('powerMonitor'),
    },
  };
}

test('composing the core starts nothing, and a change before start reads nothing that start creates', () => {
  const { electron, log } = fakeElectron('/nowhere');
  const started = {};
  const core = composeCore({ electron, smoke: null, started, isQuitting: () => false });
  assert.deepEqual(log, []);
  assert.equal(core.root, join(__dirname, '..'));
  assert.equal(core.rendererUrl, 'app://renderer/index.html');
  assert.equal(core.rendererRoot, join(__dirname, '..', 'ui', 'dist'));
  assert.equal(core.shortcutsSuspended(), false);
  assert.equal(typeof core.changed, 'function');
});

test('start builds every service over the workspace in order and registers the controllers once', async (t) => {
  const userData = mkdtempSync(join(tmpdir(), 'phases-'));
  t.after(() => rmSync(userData, { recursive: true, force: true }));
  const { electron, channels } = fakeElectron(userData);
  const started = {};
  const core = composeCore({
    electron,
    smoke: { screenshot: () => null },
    started,
    isQuitting: () => false,
  });
  Object.assign(started, composeControls({ electron, platform: 'darwin', core, started, quit: () => {} }));
  await composeServices({ electron, smoke: {}, platform: 'darwin', core, started });
  for (const name of [
    'repositories',
    'compactor',
    'transcriptCompactor',
    'localModels',
    'runtimeInstaller',
    'engines',
    'chatgptAuth',
    'chatgptAccounts',
    'selectionWatcher',
    'copyWatcher',
    'generation',
    'privacy',
    'workspaceState',
  ])
    assert.ok(started[name], `${name} exists after start`);
  registerControllers({ electron, core, started });
  assert.ok(started.outputLeases);
  assert.deepEqual(
    channels.filter((channel, index) => channels.indexOf(channel) !== index),
    [],
  );
  for (const channel of ['settings:update', 'credentials:save', 'sessions:create', 'audio:transcribe', 'ai:generate'])
    assert.ok(channels.includes(channel), `${channel} is registered`);
  started.saveSettings({ autoScroll: false });
  assert.equal(started.repositories.settings.read().autoScroll, false);
  started.repositories.db.close();
});

test('the desktop opens hidden behind the floating bar and registers the shortcuts with the saved table', () => {
  const calls = [];
  const settings = { launchFloating: true, shortcuts: '{}' };
  const registry = [];
  const started = {
    repositories: { settings: { read: () => settings } },
    privacy: { update: () => calls.push('privacy') },
    tray: { update: () => calls.push('tray') },
    dispatchShortcut: () => {},
    shortcutAccelerator: () => 'Cmd+H',
  };
  const listeners = { on: () => {} };
  startDesktop({
    electron: {
      app: { name: 'LearnTranscriber', on: () => {} },
      globalShortcut: {
        register: (accelerator) => registry.push(accelerator) && true,
        unregister: () => {},
        unregisterAll: () => {},
        isRegistered: () => false,
      },
      powerMonitor: listeners,
      screen: listeners,
      Menu: { buildFromTemplate: () => ({}), setApplicationMenu: () => calls.push('menu') },
    },
    platform: 'darwin',
    core: {
      windows: {
        openMain: (options) => calls.push(`main shown ${options.show}`),
        showOverlay: () => calls.push('overlay'),
        barVisible: () => true,
        showMain: () => {},
      },
      shortcutStatus: {},
      shortcutsSuspended: () => false,
      readSettings: () => settings,
      changed: () => {},
    },
    started,
  });
  assert.deepEqual(calls, ['main shown false', 'privacy', 'overlay', 'tray', 'tray', 'menu']);
  assert.ok(started.shortcutRegistry);
});

test('the first quit with local models waits for the ordered shutdown; a quit without them closes at once', async () => {
  const calls = [];
  let quitting = false;
  const closer = (name) => ({ close: () => calls.push(`${name} closed`) });
  const core = {
    windows: { showMain: () => calls.push('main'), showOverlay: () => calls.push('overlay') },
    screenInsights: { cancel: () => calls.push('insights cancelled') },
    shutdown: { run: async () => calls.push('shutdown') },
    nativeContext: closer('context'),
    nativeSpeech: closer('speech'),
    requests: { cancelAll: () => calls.push('requests cancelled') },
  };
  const started = {
    localModels: {},
    selectionWatcher: closer('selection'),
    copyWatcher: closer('copy'),
    privacy: { concealed: false },
    repositories: { settings: { read: () => ({ launchFloating: true }) }, db: closer('db') },
  };
  const lifecycle = composeLifecycle({
    electron: {
      app: { quit: () => calls.push('app quit') },
      globalShortcut: { unregisterAll: () => calls.push('shortcuts released') },
    },
    core,
    started,
    markQuitting: () => {
      quitting = true;
    },
  });
  lifecycle.activate();
  let prevented = false;
  lifecycle.beforeQuit({ preventDefault: () => (prevented = true) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(prevented, true);
  assert.equal(quitting, false);
  assert.deepEqual(calls, ['overlay', 'insights cancelled', 'selection closed', 'copy closed', 'shutdown', 'app quit']);
  calls.length = 0;
  lifecycle.beforeQuit({ preventDefault: () => assert.fail('the second quit is not held') });
  assert.equal(quitting, true);
  assert.deepEqual(calls, ['selection closed', 'copy closed', 'context closed', 'speech closed', 'requests cancelled']);
  calls.length = 0;
  lifecycle.willQuit();
  assert.deepEqual(calls, ['shortcuts released', 'db closed']);
});

test('reopening the app after an emergency hide restores the windows and shows the floating bar', () => {
  const calls = [];
  const started = {
    privacy: {
      concealed: true,
      restore() {
        this.concealed = false;
        calls.push('restored');
      },
    },
    repositories: { settings: { read: () => ({ launchFloating: true }) } },
  };
  const core = { windows: { showOverlay: () => calls.push('overlay'), showMain: () => calls.push('main') } };
  const lifecycle = composeLifecycle({
    electron: { app: {}, globalShortcut: {} },
    core,
    started,
    markQuitting: () => {},
  });
  lifecycle.activate();
  assert.deepEqual(calls, ['restored', 'overlay']);
  calls.length = 0;
  lifecycle.activate();
  assert.deepEqual(calls, ['overlay']);
});
