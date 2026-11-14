const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createActiveSession } = require('../src/main/application/runtime/active-session.cjs');
const { createHistoryData } = require('../src/main/application/sessions/history-data.cjs');
const { createIpcRegistrar } = require('../src/main/interface/ipc/register.cjs');
const { registerWorkspace } = require('../src/main/interface/ipc/workspace.cjs');
const { registerWindows } = require('../src/main/interface/ipc/windows.cjs');
const { registerAudio } = require('../src/main/interface/ipc/audio.cjs');

test('a live transcription startup failure belongs to the caller and is not also broadcast', async () => {
  const handlers = new Map(),
    reported = [];
  const handle = createIpcRegistrar({
    ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) },
    trusted: () => {},
    accepts: () => true,
  });
  registerAudio(handle, {
    live: {
      start: async () => {
        throw new Error('Speech permission is required.');
      },
    },
    onError: (message) => reported.push(message),
  });
  const result = await handlers.get('live:start')({ sender: { id: 7 } }, 'session');
  assert.deepEqual(result, { ok: false, error: 'Speech permission is required.' });
  assert.deepEqual(reported, []);
});

function harness(t) {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const active = createActiveSession(),
    handlers = new Map(),
    calls = [],
    quits = [];
  const main = {
      id: 'main',
      hide: () => calls.push('hide-main'),
      isDestroyed: () => false,
      webContents: { send: (channel, value) => calls.push(['main', channel, value]) },
    },
    overlay = {
      id: 'overlay',
      hide: () => calls.push('hide-overlay'),
      isDestroyed: () => false,
      focus: () => calls.push('focus-overlay'),
      webContents: { isLoadingMainFrame: () => false, send: (channel, text) => calls.push([channel, text]) },
    },
    bar = { isDestroyed: () => false, webContents: { send: (channel, value) => calls.push([channel, value]) } };
  const roles = new Map([
    [main, 'main'],
    [overlay, 'overlay'],
    [bar, 'overlay'],
  ]);
  const callers = {
    windowOf: (event) => event.sender,
    roleOf: (event) => roles.get(event.sender),
    isMain: (event) => event.sender === main,
  };
  const handle = createIpcRegistrar({
    ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) },
    trusted: () => {},
    accepts: () => true,
  });
  registerWorkspace(handle, {
    state: () => ({ ok: true }),
    shortcuts: { dispatch: (action) => calls.push(`shortcut:${action}`) },
    approvals: { list: () => [], decide: () => {} },
    discover: { localServers: async () => [], obsidian: async () => [] },
    history: createHistoryData({
      repos,
      active,
      compactor: () => ({ undo: () => ({ count: 0 }) }),
      changed: () => calls.push('publish'),
    }),
    folders: { reveal: async (name) => calls.push(`reveal:${name}`) },
    generate: async () => 'answer',
    callers,
    quit: {
      ready: (info) => {
        calls.push('quit-ready');
        quits.push(info);
      },
    },
    errors: {
      log: (message) => calls.push(['logged', message]),
      forward: (sender, message) => calls.push(['forwarded', sender === main ? 'main' : 'other', message]),
    },
  });
  registerWindows(handle, {
    callers,
    windows: {
      setListening: (active, starting) => calls.push(['listening', active, starting]),
      setOverlayExpanded: (_w, value) => calls.push(`expand:${value}`),
      toggleOverlay: () => {},
      showMain: () => {},
      showOverlay: () => calls.push('show-overlay'),
      main: () => main,
      overlay: () => overlay,
      bar: () => bar,
      setBarPopoverOpen: (open) => calls.push(['picker', open]),
    },
    mainActions: { open: (action) => calls.push(`open:${action}`) },
    privacy: () => ({}),
    changed: () => {},
  });
  const call = (sender, channel, ...args) => handlers.get(channel)({ sender }, ...args);
  return { repos, active, calls, main, overlay, bar, call, quits };
}

test('renderer shortcuts are limited to workspace actions', async (t) => {
  const { calls, main, call } = harness(t);
  assert.deepEqual(await call(main, 'shortcuts:dispatch', 'hide'), { ok: false, error: 'Unsupported action.' });
  assert.equal((await call(main, 'shortcuts:dispatch', 'ask')).ok, true);
  assert.equal((await call(main, 'shortcuts:dispatch', 'toggleRecording')).ok, true);
  assert.deepEqual(calls, ['shortcut:ask', 'shortcut:toggleRecording']);
});

test('only the recording owner reports preparation and it cannot claim listening at the same time', async (t) => {
  const { main, overlay, calls, call } = harness(t);
  assert.equal((await call(overlay, 'audio:listening', false, true)).ok, false);
  assert.equal((await call(main, 'audio:listening', true, true)).ok, false);
  assert.equal((await call(main, 'audio:listening', false, 'yes')).ok, false);
  assert.deepEqual(calls, []);
  assert.equal((await call(main, 'audio:listening', false, true)).ok, true);
  assert.equal((await call(main, 'audio:listening', true)).ok, true);
  assert.equal((await call(main, 'audio:listening', false)).ok, true);
  assert.deepEqual(calls, [
    ['listening', false, true],
    ['listening', true, false],
    ['listening', false, false],
  ]);
});

test('only the main window clears history, and never during a live session', async (t) => {
  const { repos, active, overlay, main, call } = harness(t);
  repos.sessions.create('Old', 'general');
  assert.equal((await call(overlay, 'data:clear')).error, 'Clear history from the main workspace.');
  active.set('live');
  assert.equal((await call(main, 'data:clear')).error, 'End the active session before clearing history.');
  assert.equal(repos.sessionSearch.list().length, 1);
});

test('only the main window confirms the quit handshake', async (t) => {
  const { calls, main, overlay, call } = harness(t);
  await call(overlay, 'app:quit-ready');
  await call(main, 'app:quit-ready');
  assert.deepEqual(calls, ['quit-ready']);
});

test('only the floating assistant can resize or close itself', async (t) => {
  const { calls, main, overlay, call } = harness(t);
  assert.equal((await call(main, 'overlay:close')).ok, false);
  assert.equal((await call(main, 'overlay:expand', true)).ok, false);
  assert.equal((await call(overlay, 'overlay:expand', 'yes')).ok, false);
  await call(overlay, 'overlay:expand', false);
  await call(overlay, 'overlay:close');
  assert.deepEqual(calls, ['expand:false', 'expand:false']);
  assert.equal(
    (await call(main, 'assistants:open-library')).error,
    'Only the floating assistant can open the assistant library.',
  );
});

test('the quit handshake carries how many recorded segments were discarded', async (t) => {
  const { main, call, quits } = harness(t);
  await call(main, 'app:quit-ready', { discardedSegments: 2 });
  await call(main, 'app:quit-ready', { discardedSegments: 'many' });
  assert.deepEqual(quits, [{ discardedSegments: 2 }, { discardedSegments: 0 }], 'only a positive count is accepted');
});

test('only the recording workspace reports audio levels, and valid ones reach the floating bar', async (t) => {
  const { main, overlay, calls, call } = harness(t);
  assert.equal((await call(overlay, 'audio:levels', { me: 0.5, they: 0.5 })).ok, false);
  assert.equal((await call(main, 'audio:levels', { me: 2, they: 0 })).ok, false);
  assert.equal((await call(main, 'audio:levels', { me: 'loud', they: 0 })).ok, false);
  assert.equal((await call(main, 'audio:levels', null)).ok, false);
  assert.deepEqual(calls, []);
  assert.equal((await call(main, 'audio:levels', { me: 0.25, they: 1, extra: 'dropped' })).ok, true);
  assert.deepEqual(calls, [
    ['main', 'audio:levels', { me: 0.25, they: 1 }],
    ['audio:levels', { me: 0.25, they: 1 }],
  ]);
});

test('only the recording bar can request bounded space for its assistant picker', async (t) => {
  const { main, overlay, bar, call, calls } = harness(t);
  assert.equal((await call(main, 'overlay:bar-popover', true)).ok, false);
  assert.equal((await call(overlay, 'overlay:bar-popover', true)).ok, false);
  assert.equal((await call(bar, 'overlay:bar-popover', 'yes')).ok, false);
  assert.equal((await call(bar, 'overlay:bar-popover', true)).ok, true);
  assert.equal((await call(bar, 'overlay:bar-popover', false)).ok, true);
  assert.deepEqual(calls, [
    ['picker', true],
    ['picker', false],
  ]);
});

test('other windows open workspace pages through the shared workspace action', async (t) => {
  const { calls, main, overlay, call } = harness(t);
  await call(overlay, 'workspace:open-ai-models');
  await call(overlay, 'workspace:open-ai-sources');
  await call(overlay, 'workspace:open-audio-sources');
  assert.equal((await call(main, 'assistants:open-library')).ok, false);
  await call(overlay, 'assistants:open-library');
  assert.deepEqual(calls, ['open:openAiModels', 'open:openAiSources', 'open:openAudioSources', 'open:openAssistants']);
});

test('only the workspace opens the app folders, and only the data and logs folders', async (t) => {
  const { calls, main, overlay, call } = harness(t);
  assert.equal((await call(overlay, 'data:reveal-folder', 'logs')).error, 'Open folders from the main workspace.');
  assert.equal((await call(main, 'data:reveal-folder', '/etc')).error, 'Unknown folder.');
  await call(main, 'data:reveal-folder', 'data');
  await call(main, 'data:reveal-folder', 'logs');
  assert.deepEqual(calls, ['reveal:data', 'reveal:logs']);
});

test('opening the floating session expands the panel from the workspace and validates the request', async (t) => {
  const { main, call, calls } = harness(t);
  assert.equal((await call(main, 'overlay:show', 'yes')).ok, false);
  assert.equal((await call(main, 'overlay:show', true)).ok, true);
  assert.deepEqual(calls, ['expand:true', 'show-overlay', 'focus-overlay', ['workspace:action', 'showResponse']]);
});

test('bar question opening transfers only its draft to the floating window, never the workspace', async (t) => {
  const { bar, calls, call } = harness(t);
  assert.equal((await call(bar, 'overlay:compose', 'Explain this')).ok, true);
  assert.deepEqual(calls, ['show-overlay', 'expand:true', ['overlay:question-draft', 'Explain this'], 'focus-overlay']);
});
test('invalid question drafts cannot open a window', async (t) => {
  const { bar, calls, call } = harness(t);
  for (const draft of [null, {}, 'x'.repeat(20001)])
    assert.equal((await call(bar, 'overlay:compose', draft)).ok, false);
  assert.deepEqual(calls, []);
});

test('an error a window showed is logged, and forwarded only when that window asks', async (t) => {
  const { calls, main, call } = harness(t);
  calls.length = 0;
  assert.deepEqual(await call(main, 'workspace:report-error', { message: 'Microphone blocked', forward: true }), {
    ok: true,
    value: true,
  });
  await call(main, 'workspace:report-error', { message: 'Visible here', forward: false });
  assert.deepEqual(await call(main, 'workspace:report-error', { message: '' }), { ok: true, value: false });
  assert.deepEqual(calls, [
    ['logged', 'Microphone blocked'],
    ['forwarded', 'main', 'Microphone blocked'],
    ['logged', 'Visible here'],
  ]);
});

test('permission feedback crosses the existing IPC with its action; unknown permissions stay plain errors', async (t) => {
  const { main, call, calls } = harness(t);
  await call(main, 'workspace:report-error', {
    message: 'Capture denied',
    forward: true,
    notice: { permission: 'screen' },
  });
  await call(main, 'workspace:report-error', {
    message: 'Unknown permission',
    forward: true,
    notice: { permission: 'camera' },
  });
  assert.deepEqual(calls, [
    ['logged', 'Capture denied'],
    ['forwarded', 'main', { message: 'Capture denied', notice: { permission: 'screen' } }],
    ['logged', 'Unknown permission'],
    ['forwarded', 'main', 'Unknown permission'],
  ]);
});
