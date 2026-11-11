const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

function fakeElectron(log) {
  const record = (name) =>
    new Proxy(function () {}, {
      get: (_target, key) =>
        key === 'isPackaged'
          ? false
          : key === 'getAppPath'
            ? () => '/app'
            : () => {
                log.push(`${name}.${String(key)}`);
                return undefined;
              },
      construct: () => {
        log.push(`new ${name}`);
        return {};
      },
    });
  return {
    app: record('app'),
    ipcMain: { handle: (channel) => log.push(`ipc:${channel}`) },
    BrowserWindow: record('BrowserWindow'),
    Menu: record('Menu'),
    Tray: record('Tray'),
    nativeImage: record('nativeImage'),
    globalShortcut: record('globalShortcut'),
    safeStorage: record('safeStorage'),
    screen: record('screen'),
    desktopCapturer: record('desktopCapturer'),
    session: {},
    systemPreferences: record('systemPreferences'),
    clipboard: record('clipboard'),
    dialog: record('dialog'),
    shell: record('shell'),
    powerMonitor: record('powerMonitor'),
  };
}

test('importing and composing the application starts nothing until start()', () => {
  const log = [];
  const { composeApplication } = require('../src/main/composition.cjs');
  const application = composeApplication({ electron: fakeElectron(log) });
  assert.deepEqual(log, []);
  assert.deepEqual(Object.keys(application).sort(), [
    'activate',
    'beforeQuit',
    'showMain',
    'start',
    'startupFailed',
    'willQuit',
  ]);
});

test('the entry only composes the application and registers no channel itself', () => {
  const entry = readFileSync(join(__dirname, '../src/main/index.cjs'), 'utf8');
  assert.doesNotMatch(entry, /--mcp-stdio/);
  assert.doesNotMatch(entry, /ipcMain|handle\('/);
});

test('every IPC channel is registered exactly once by the composition', () => {
  const files = [
    'composition.cjs',
    ...require('node:fs')
      .readdirSync(join(__dirname, '../src/main/interface/ipc'))
      .map((file) => `interface/ipc/${file}`),
  ];
  const channels = files.flatMap((file) =>
    [...readFileSync(join(__dirname, '../src/main', file), 'utf8').matchAll(/handle\('([a-z-]+:[a-z-]+)'/g)].map(
      (match) => match[1],
    ),
  );
  const duplicates = channels.filter((channel, index) => channels.indexOf(channel) !== index);
  assert.deepEqual(duplicates, []);
  const preload = readFileSync(join(__dirname, '../src/main/preload.cjs'), 'utf8');
  const invoked = new Set([...preload.matchAll(/invoke\('([a-z-]+:[a-z-]+)'/g)].map((match) => match[1]));
  assert.deepEqual(
    [...invoked].filter((channel) => !channels.includes(channel)),
    [],
  );
});

// The root and the feature wiring it delegates to under composition/.
function compositionSource() {
  const directory = join(__dirname, '../src/main/composition');
  return [
    join(__dirname, '../src/main/composition.cjs'),
    ...readdirSync(directory).map((file) => join(directory, file)),
  ]
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
}

test('the composition connects Gemini Live, the session-start reads and GPU process exits', () => {
  const source = compositionSource();
  // The Gemini Live engine is created with the Gemini key, routed, drained, closed and stopped with its window.
  assert.match(source, /gemini: new GeminiLiveTranscription\(transcripts, async \(\) => vault\.read\('gemini'\)/);
  assert.match(source, /gemini: engines\.gemini/);
  assert.match(source, /engines\?\.gemini\.drain\(\)/);
  assert.match(source, /engines\.gemini\.close\(\)/);
  assert.match(source, /transcribers: \(\) => \[[^\]]*live\(\)\?\.gemini/);
  // A started session gets its baseline screen read and its live-response instruction.
  assert.match(
    source,
    /started: \(id\) => \{\s*screenInsights\.sessionStarted\(id\);\s*void prepareLiveGuidance\(id\);/,
  );
  assert.match(source, /prepareOnSessionStart\(\{ settings, sessions, assistants, realtimePrompts \}\)/);
  assert.match(source, /app\.on\('child-process-gone', \(_event, details\) => windows\.childGone\(details\)\)/);
});
