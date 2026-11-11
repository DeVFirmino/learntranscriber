const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createActiveSession } = require('../src/main/application/runtime/active-session.cjs');
const { createShortcutActions, SURFACE_ACTIONS } = require('../src/main/interface/desktop/shortcuts.cjs');
const { DEFINITIONS } = require('../src/main/domain/settings/shortcuts.cjs');

function harness({
  settings = {},
  panel = true,
  notch = false,
  concealed = false,
  suspended = false,
  mainOpen = true,
  overlayOpen = true,
} = {}) {
  const calls = [],
    sent = [],
    active = createActiveSession();
  const state = { panel, notch, concealed, suspended, expanded: panel };
  const win = (name, visible) => ({
    isDestroyed: () => false,
    focus: () => calls.push('focus-' + name),
    isVisible: visible,
    webContents: { send: (channel, action) => sent.push([name, channel, action]), isLoadingMainFrame: () => false },
  });
  let main = mainOpen ? win('main', () => true) : null;
  const overlay = win('panel', () => state.panel),
    notchWindow = win('notch', () => state.notch);
  const values = { overlayOpacity: 0.95, overlayClickThrough: false, overlayOnTop: true, notchEnabled: false };
  Object.assign(values, settings, { shortcuts: '{}' });
  const actions = createShortcutActions({
    suspended: () => state.suspended,
    privacy: () => ({
      concealed: state.concealed,
      toggleConcealment: () => {
        state.concealed = !state.concealed;
        calls.push('conceal-toggle');
      },
      show: () => calls.push('show-main'),
    }),
    windows: {
      main: () => main,
      ensureMain: () => {
        if (!main) {
          main = win('main', () => false);
          calls.push('recreate-main');
        }
        return main;
      },
      notch: () => notchWindow,
      open: (window) => Boolean(window) && (window !== overlay || overlayOpen),
      overlay: () => overlay,
      panelVisible: () => state.panel && !state.concealed,
      nudgePanel: (dx, dy) => calls.push(`slide-panel:${dx}:${dy}`),
      toggleOverlay: () => calls.push('toggle-floating'),
      showOverlay: () => calls.push('show-floating'),
      overlayExpanded: () => state.expanded,
      setOverlayExpanded: (_window, next) => {
        state.expanded = next;
        calls.push('expand-panel');
      },
      showMain: () => calls.push('show-main'),
      listening: () => ({ active: Boolean(state.listening) }),
    },
    settings: () => values,
    saveSettings: (patch) => {
      Object.assign(values, patch);
      calls.push(patch);
    },
    active,
    nativeContext: { selection: async () => ({ text: '' }) },
    broadcast: () => {},
    changed: () => calls.push('publish'),
  });
  return { actions, calls, sent, state };
}

test('opacity steps move in 10% increments between 25% and 100%', () => {
  const { actions, calls } = harness();
  actions.dispatch('clickThrough');
  actions.dispatch('onTop');
  actions.dispatch('opacityUp');
  actions.dispatch('opacityDown');
  actions.dispatch('opacityDown');
  actions.dispatch('notch');
  assert.deepEqual(calls, [
    { overlayClickThrough: true },
    { overlayOnTop: false },
    { overlayOpacity: 1 },
    { overlayOpacity: 0.9 },
    { overlayOpacity: 0.8 },
    { notchEnabled: true },
  ]);
  const low = harness({ settings: { overlayOpacity: 0.3 } });
  low.actions.dispatch('opacityDown');
  assert.deepEqual(low.calls, [{ overlayOpacity: 0.25 }]);
});

test('slide shortcuts move only a shown session panel; the recording bar has no move path', () => {
  const shown = harness();
  for (const action of ['moveLeft', 'moveRight', 'moveUp', 'moveDown'])
    assert.equal(shown.actions.dispatch(action), true);
  assert.deepEqual(shown.calls, ['slide-panel:-30:0', 'slide-panel:30:0', 'slide-panel:0:-30', 'slide-panel:0:30']);
  const collapsed = harness({ panel: false });
  for (const action of ['moveLeft', 'moveRight', 'moveUp', 'moveDown'])
    assert.equal(collapsed.actions.dispatch(action), false);
  assert.deepEqual(collapsed.calls, []);
});

test('scrolling reaches the shown panel, then the Notch, and is dropped with neither', () => {
  const panel = harness({ notch: true });
  panel.actions.dispatch('scrollUp');
  panel.actions.dispatch('previousResponse');
  assert.deepEqual(panel.sent, [
    ['panel', 'workspace:action', 'scrollUp'],
    ['panel', 'workspace:action', 'previousResponse'],
  ]);
  const notch = harness({ panel: false, notch: true });
  assert.equal(notch.actions.dispatch('scrollDown'), true);
  assert.equal(notch.actions.dispatch('nextResponse'), false);
  assert.deepEqual(notch.sent, [['notch', 'workspace:action', 'scrollDown']]);
  const neither = harness({ panel: false });
  assert.equal(neither.actions.dispatch('scrollDown'), false);
  assert.equal(neither.actions.dispatch('nextInsight'), false);
  assert.deepEqual(neither.sent, []);
});

test('Ask opens the floating question box; Command-D shows the bar and leaves start-or-analyze to the recorder', () => {
  const { actions, sent, calls, state } = harness({ panel: false });
  state.expanded = false;
  actions.dispatch('ask');
  actions.dispatch('record');
  assert.deepEqual(sent, [
    ['panel', 'workspace:action', 'ask'],
    ['main', 'workspace:action', 'record'],
  ]);
  assert.deepEqual(calls, ['show-floating', 'expand-panel', 'focus-panel', 'show-floating']);
});

test('while everything is hidden, surface shortcuts are dropped and window shortcuts still act', () => {
  const { actions, sent, calls, state } = harness({ concealed: true, notch: true });
  for (const action of SURFACE_ACTIONS) assert.equal(actions.dispatch(action), false, action);
  assert.deepEqual(sent, []);
  assert.deepEqual(calls, []);
  actions.dispatch('overlay');
  actions.dispatch('onTop');
  actions.dispatch('opacityDown');
  assert.equal(state.concealed, true, 'the floating toggle does not reveal hidden windows');
  actions.dispatch('hide');
  assert.equal(state.concealed, false);
  assert.deepEqual(calls, [
    'toggle-floating',
    { overlayOnTop: false },
    { overlayOpacity: 0.85 },
    'conceal-toggle',
    'publish',
  ]);
});

// Every shortcut with a known action, in idle and recording sessions, with surfaces shown and hidden. The main
// process does not know whether a recording runs: Command-D always reaches the recorder as "record", which starts
// listening when idle and analyzes without stopping when active, so no state ever turns a shortcut into a stop.
test('all 19 shortcuts with a known action, across idle/recording and visible/hidden states', () => {
  const reference = DEFINITIONS.filter((d) => d.reference);
  assert.equal(reference.length, 19);
  const matrix = {};
  for (const recording of [false, true])
    for (const hidden of [false, true]) {
      for (const { id, reference: name } of reference) {
        const { actions, sent, calls, state } = harness({ concealed: hidden, notch: true });
        const delivered = actions.dispatch(id);
        assert.ok(!sent.some(([, , action]) => action === 'toggleRecording'), `${name} never stops recording`);
        if (hidden && SURFACE_ACTIONS.has(id)) {
          assert.equal(delivered, false, `${name} is dropped while hidden`);
          assert.deepEqual([sent, calls], [[], []]);
        } else assert.equal(delivered, true, `${name} is delivered`);
        if (id === 'record' && !hidden) assert.deepEqual(sent, [['main', 'workspace:action', 'record']]);
        if (id !== 'hide') assert.equal(state.concealed, hidden, `${name} leaves concealment unchanged`);
        matrix[`${recording ? 'recording' : 'idle'}/${hidden ? 'hidden' : 'visible'}/${name}`] = delivered;
      }
    }
  assert.equal(Object.keys(matrix).length, 76);
  assert.equal(Object.values(matrix).filter((value) => !value).length, 28);
});

test('an accelerator is reported only for an enabled shortcut', () => {
  const { actions } = harness();
  assert.equal(actions.accelerator('hide'), 'CommandOrControl+B');
  assert.equal(actions.accelerator('notch'), undefined);
  assert.equal(actions.accelerator('missing'), undefined);
});

test('editing shortcut bindings blocks every shortcut without moving windows or changing recording', () => {
  const { actions, calls, sent, state } = harness({ suspended: true });
  for (const { id } of DEFINITIONS) assert.equal(actions.dispatch(id), false, id);
  assert.deepEqual([calls, sent], [[], []]);
  state.suspended = false;
  assert.equal(actions.dispatch('record'), true);
  assert.deepEqual(calls, ['show-floating']);
  assert.deepEqual(sent, [['main', 'workspace:action', 'record']]);
});

test('capture opens the floating Session tab and captures there, never in the workspace, and stays inert while concealed', () => {
  const { actions, calls, sent } = harness({ panel: false });
  assert.equal(actions.dispatch('capture'), true);
  assert.deepEqual(calls, ['show-floating', 'expand-panel', 'focus-panel']);
  assert.deepEqual(sent, [['panel', 'workspace:action', 'capture']]);
  assert.ok(!calls.includes('show-main'));
  const hidden = harness({ concealed: true });
  assert.equal(hidden.actions.dispatch('capture'), false);
  assert.deepEqual([hidden.calls, hidden.sent], [[], []]);
});

test('a destroyed workspace window comes back hidden, so Command-D still reaches the recorder', () => {
  for (const action of ['record', 'toggleRecording']) {
    const { actions, calls, sent } = harness({ mainOpen: false });
    assert.equal(actions.dispatch(action), true, action);
    assert.ok(calls.includes('recreate-main'), action);
    assert.deepEqual(sent.at(-1), ['main', 'workspace:action', action]);
  }
});

test('Command-D while listening opens the session panel so the answer shows as it streams', () => {
  const { actions, sent, calls, state } = harness({ panel: false });
  state.expanded = false;
  state.listening = true;
  actions.dispatch('record');
  assert.deepEqual(calls, ['show-floating', 'expand-panel']);
  assert.deepEqual(sent.at(-1), ['main', 'workspace:action', 'record']);
});

test('the recording toggle brings a hidden floating assistant back without showing the workspace', () => {
  const { actions, calls, sent } = harness({ panel: false });
  actions.dispatch('toggleRecording');
  assert.deepEqual(calls, ['show-floating']);
  assert.deepEqual(sent, [['main', 'workspace:action', 'toggleRecording']]);
});

test('Ask never falls back to the main window when the floating window is unavailable', () => {
  const h = harness({ overlayOpen: false, mainOpen: false });
  assert.equal(h.actions.dispatch('ask'), false);
  assert.deepEqual(h.sent, []);
  assert.deepEqual(h.calls, ['show-floating']);
});
