const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createWindows } = require('../src/main/infrastructure/electron/windows.cjs');
const { barRows, ROW_HEIGHTS } = require('../src/main/domain/overlay/bar-rows.cjs');
const { BAR_POPOVER_HEIGHT } = require('../src/main/domain/windows/layout.cjs');
const { createRendererRecovery } = require('../src/main/infrastructure/electron/renderer-recovery.cjs');

// `publish` mirrors the workspace publication, which settles the bar's session rows after every change.
function harness({
  activeId = () => 'session',
  publish = false,
  recovery,
  destroyed = [],
  settingsEvents = [],
  current = { notchEnabled: false },
} = {}) {
  class Window extends EventEmitter {
    constructor(options) {
      super();
      this.bounds = { x: options.x || 0, y: options.y || 0, width: options.width, height: options.height };
      this.visible = false;
      this.webContents = new EventEmitter();
      Object.assign(this.webContents, {
        id: Window.nextId++,
        setWindowOpenHandler() {},
        isLoadingMainFrame: () => false,
      });
    }
    isDestroyed() {
      return false;
    }
    getBounds() {
      return { ...this.bounds };
    }
    setBounds(bounds) {
      Object.assign(this.bounds, bounds);
      this.emit('resized');
    }
    setPosition(x, y) {
      this.setBounds({ x, y });
    }
    isVisible() {
      return this.visible;
    }
    hide() {
      this.visible = false;
    }
    close() {
      const event = { preventDefault() {} };
      this.emit('close', event);
    }
    loadURL(url) {
      this.query = Object.fromEntries(new URL(url).searchParams);
    }
    reload() {
      this.reloads = (this.reloads || 0) + 1;
    }
  }
  Window.nextId = 1;
  const area = { x: 0, y: 32, width: 1512, height: 950 };
  const privacy = {
    concealed: false,
    register() {},
    show: (window) => {
      window.visible = true;
    },
    hide: (window) => {
      window.visible = false;
    },
  };
  const windows = createWindows({
    BrowserWindow: Window,
    screen: { getPrimaryDisplay: () => ({ workArea: area }), getDisplayMatching: () => ({ workArea: area }) },
    privacy: () => privacy,
    settings: () => current,
    active: { id: activeId },
    notchState: {},
    renderer: { path: '/renderer.html', url: 'file:///renderer.html' },
    preload: '/preload.cjs',
    isQuitting: () => false,
    onOwnerClosing() {},
    onOwnerDestroyed: (id) => destroyed.push(id),
    onSettingsOpen: (open) => settingsEvents.push(open),
    ...(recovery ? { recovery } : {}),
    changed() {
      if (publish) windows.syncBar();
    },
  });
  return { windows, area, privacy };
}

test('only main-frame Settings navigation suspends shortcuts and leaving, hiding or losing its renderer restores them', () => {
  const settingsEvents = [];
  const { windows } = harness({ settingsEvents, recovery: { rendererGone() {} } });
  windows.openMain();
  windows.showOverlay();
  const main = windows.main(),
    panel = windows.overlay();
  panel.webContents.emit('did-navigate-in-page', {}, 'file:///renderer.html#settings', true);
  main.webContents.emit('did-navigate-in-page', {}, 'file:///renderer.html#settings', false);
  main.webContents.emit('did-navigate-in-page', {}, 'file:///other.html#settings', true);
  main.webContents.emit('did-navigate-in-page', {}, 'file:///renderer.html#settings-other', true);
  assert.deepEqual(settingsEvents, []);
  main.webContents.emit('did-navigate-in-page', {}, 'file:///renderer.html?window=main#settings/audio', true);
  assert.deepEqual(settingsEvents, [], 'audio settings keep the floating assistant shortcuts active');
  main.webContents.emit('did-navigate-in-page', {}, 'file:///renderer.html#settings/shortcuts', true);
  assert.deepEqual(settingsEvents, [true], 'the shortcut editor suspends keys while rebinding');
  main.webContents.emit('did-navigate-in-page', {}, 'file:///renderer.html#home', true);
  assert.deepEqual(settingsEvents, [true, false]);
  main.webContents.getURL = () => 'file:///renderer.html#settings/shortcuts';
  main.emit('show');
  main.emit('hide');
  assert.deepEqual(settingsEvents.slice(-2), [true, false]);
  main.webContents.emit('did-navigate', {}, 'file:///renderer.html#settings/shortcuts');
  main.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  assert.deepEqual(settingsEvents.slice(-2), [true, false]);
  main.webContents.emit('did-navigate', {}, 'file:///renderer.html#settings/shortcuts');
  main.webContents.emit('destroyed');
  assert.deepEqual(settingsEvents.slice(-2), [true, false]);
});

test('moving, resizing and collapsing the session panel leave the recording bar at the screen bottom', () => {
  const { windows, area } = harness();
  windows.showOverlay();
  const panel = windows.overlay(),
    bar = windows.bar();
  assert.notEqual(panel, bar);
  const fixed = bar.getBounds();
  assert.equal(fixed.y + fixed.height, area.y + area.height - 16);
  windows.setOverlayExpanded(panel, true);
  for (const [x, y] of [
    [40, 80],
    [800, 300],
    [200, 120],
  ]) {
    panel.setPosition(x, y);
    windows.resizeOverlay(panel, 640, 500);
    assert.deepEqual(bar.getBounds(), fixed);
  }
  windows.resizeOverlay(bar, 700, 550);
  assert.deepEqual(bar.getBounds(), fixed);
  windows.setOverlayExpanded(panel, false);
  assert.equal(panel.isVisible(), false);
  assert.equal(bar.isVisible(), true);
  assert.deepEqual(bar.getBounds(), fixed);
  // The bar's expand button opens the panel; it never resizes the bar itself.
  windows.setOverlayExpanded(bar, true);
  assert.equal(panel.isVisible(), true);
  assert.deepEqual(bar.getBounds(), fixed);
});

test('the bar session rows follow the surfaces-hidden contract, adapted to Session delivery', () => {
  const cells = [];
  for (const hasActiveSession of [false, true])
    for (const capturing of [false, true])
      for (const sessionSurfaceVisible of [false, true]) {
        const rows = barRows({ hasActiveSession, sessionSurfaceVisible, capturing });
        cells.push(
          `${hasActiveSession ? 'session' : 'none'}/${capturing ? 'capturing' : 'idle'}/` +
            `${sessionSurfaceVisible ? 'panel' : 'hidden'}=${rows.prompt ? 'P' : '-'}${rows.preview ? 'T' : '-'}`,
        );
      }
  // A shown panel hides both rows; the prompt needs a live session and the preview needs capture. The Notch is not
  // an input: it is not a session surface, and the prompt's answer goes to Session whether or not it is on.
  assert.deepEqual(cells, [
    'none/idle/hidden=--',
    'none/idle/panel=--',
    'none/capturing/hidden=-T',
    'none/capturing/panel=--',
    'session/idle/hidden=P-',
    'session/idle/panel=--',
    'session/capturing/hidden=PT',
    'session/capturing/panel=--',
  ]);
});

test('collapsing the panel shows the bar rows by growing the bar upward without moving its controls', () => {
  const { windows, area } = harness({ publish: true });
  windows.showOverlay();
  const panel = windows.overlay(),
    bar = windows.bar();
  windows.setListening(true);
  assert.equal(windows.overlayExpanded(), true);
  assert.deepEqual(windows.barRows(), { prompt: false, preview: false, guide: false });
  const fixed = bar.getBounds(),
    recording = windows.listening();
  const anchor = (b) => ({ x: b.x, width: b.width, bottom: b.y + b.height });
  assert.deepEqual(anchor(fixed), { x: fixed.x, width: 560, bottom: area.y + area.height - 16 });

  for (const [x, y] of [
    [40, 80],
    [900, 260],
  ]) {
    panel.setPosition(x, y);
    windows.resizeOverlay(panel, 700, 520);
    assert.deepEqual(bar.getBounds(), fixed);
  }
  windows.setOverlayExpanded(panel, false);
  assert.deepEqual(windows.barRows(), { prompt: true, preview: true, guide: false });
  assert.deepEqual(anchor(bar.getBounds()), anchor(fixed));
  assert.equal(bar.getBounds().height, fixed.height + ROW_HEIGHTS.prompt + ROW_HEIGHTS.preview);
  assert.deepEqual(windows.listening(), recording);

  // Reopening the panel removes the rows and returns the bar to its exact bounds; recording never changed.
  windows.setOverlayExpanded(bar, true);
  assert.deepEqual(windows.barRows(), { prompt: false, preview: false, guide: false });
  assert.deepEqual(bar.getBounds(), fixed);
  assert.deepEqual(windows.listening(), recording);

  // Stopping capture with the panel collapsed leaves only the prompt; the bar shrinks toward the same bottom edge.
  windows.setOverlayExpanded(panel, false);
  windows.setListening(false);
  assert.deepEqual(windows.barRows(), { prompt: true, preview: false, guide: false });
  assert.deepEqual(anchor(bar.getBounds()), anchor(fixed));
  assert.equal(bar.getBounds().height, fixed.height + ROW_HEIGHTS.prompt);
});

test('closing the panel counts as collapsing it, and concealing leaves the rows as they were', () => {
  const { windows, privacy } = harness({ publish: true });
  windows.showOverlay();
  const panel = windows.overlay(),
    bar = windows.bar();
  windows.setOverlayExpanded(panel, true);
  panel.close();
  assert.equal(windows.overlayExpanded(), false);
  assert.equal(panel.isVisible(), false);
  assert.deepEqual(windows.barRows(), { prompt: true, preview: false, guide: false });
  const shown = bar.getBounds();
  privacy.concealed = true;
  windows.setOverlayExpanded(panel, true);
  assert.deepEqual(windows.barRows(), { prompt: true, preview: false, guide: false });
  assert.deepEqual(bar.getBounds(), shown);
});

test('the first-session tip sits above the idle bar and gives way once listening opens the panel', () => {
  assert.deepEqual(
    [false, true].map((capturing) =>
      barRows({ hasActiveSession: false, sessionSurfaceVisible: false, capturing, guiding: true }),
    ),
    [
      { prompt: false, preview: false, guide: true },
      { prompt: false, preview: true, guide: false },
    ],
  );
  assert.equal(barRows({ sessionSurfaceVisible: true, guiding: true }).guide, false);
  const current = { notchEnabled: false, onboardingGuide: true };
  const { windows } = harness({ activeId: () => null, publish: true, current });
  windows.showOverlay();
  const bar = windows.bar();
  windows.syncBar();
  assert.deepEqual(windows.barRows(), { prompt: false, preview: false, guide: true });
  const guided = bar.getBounds();
  current.onboardingGuide = false;
  windows.syncBar();
  assert.deepEqual(windows.barRows(), { prompt: false, preview: false, guide: false });
  assert.equal(guided.height, bar.getBounds().height + ROW_HEIGHTS.guide);
});

test('without a live session the collapsed bar keeps its compact bounds', () => {
  const { windows } = harness({ activeId: () => null, publish: true });
  windows.showOverlay();
  const bar = windows.bar(),
    fixed = bar.getBounds();
  windows.setOverlayExpanded(windows.overlay(), true);
  windows.setOverlayExpanded(windows.overlay(), false);
  assert.deepEqual(windows.barRows(), { prompt: false, preview: false, guide: false });
  assert.deepEqual(bar.getBounds(), fixed);
});

test('a crashed workspace renderer ends its recording and reloads, leaving the bar where it was', () => {
  const pending = [],
    destroyed = [],
    logs = [];
  const recovery = createRendererRecovery({
    log: (message) => logs.push(message),
    timers: { setTimeout: (fn, ms) => pending.push({ fn, ms }) },
  });
  const { windows } = harness({ recovery, destroyed });
  const main = windows.openMain();
  windows.showOverlay();
  const bar = windows.bar(),
    fixed = bar.getBounds();
  windows.setListening(true);
  windows.setOverlayExpanded(windows.overlay(), false);
  main.webContents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 11 });
  assert.deepEqual(destroyed, [main.webContents.id]);
  assert.deepEqual(windows.listening(), { active: false, starting: false, since: null });
  assert.deepEqual(logs, ['Renderer process gone (main): crashed, exit code 11.']);
  assert.deepEqual(
    pending.map((timer) => timer.ms),
    [1000],
  );
  pending[0].fn();
  assert.equal(main.reloads, 1);
  windows.syncBar();
  assert.equal(bar.getBounds().y + bar.getBounds().height, fixed.y + fixed.height);
  // A crashed bar renderer reloads too, but leaves the recording as it was.
  windows.setListening(true);
  bar.webContents.emit('render-process-gone', {}, { reason: 'oom', exitCode: 0 });
  assert.equal(windows.listening().active, true);
  pending.at(-1).fn();
  assert.equal(bar.reloads, 1);
});

test('opening the assistant picker grows only the bar upward and closing restores its exact bounds', () => {
  const { windows } = harness();
  windows.showOverlay();
  windows.syncBar();
  const bar = windows.bar();
  const original = bar.getBounds();
  const panel = windows.overlay().getBounds();
  windows.setBarPopoverOpen(true);
  const opened = bar.getBounds();
  assert.equal(opened.height, original.height + BAR_POPOVER_HEIGHT);
  assert.equal(opened.y + opened.height, original.y + original.height);
  assert.equal(opened.width, original.width);
  assert.deepEqual(windows.overlay().getBounds(), panel);
  windows.setBarPopoverOpen(false);
  assert.deepEqual(bar.getBounds(), original);
});

test('onboarding hides the bar, expands only its panel and restores the prior panel size on handoff', () => {
  const { windows } = harness();
  windows.showOverlay();
  const panel = windows.overlay();
  const bar = windows.bar();
  const previous = panel.getBounds();
  windows.presentOnboarding(panel, true);
  assert.equal(bar.isVisible(), false);
  assert.equal(panel.getBounds().width, 640);
  assert.equal(panel.getBounds().height, 680);
  windows.showOverlay();
  windows.toggleOverlay();
  assert.equal(bar.isVisible(), false);
  windows.presentOnboarding(null, false);
  assert.deepEqual(panel.getBounds(), previous);
  windows.showOverlay();
  assert.equal(bar.isVisible(), true);
});

test('a first launch shows the onboarding panel, which was never shown before', () => {
  const { windows } = harness();
  windows.openMain({ show: false });
  windows.showOverlay();
  const panel = windows.overlay();
  assert.equal(panel.isVisible(), false);
  windows.presentOnboarding(panel, true);
  assert.equal(windows.bar().isVisible(), false);
  assert.equal(panel.isVisible(), true);
});

test('the hidden workspace asking for onboarding after the panel leaves the panel on screen', () => {
  const { windows } = harness();
  const main = windows.openMain({ show: false });
  windows.showOverlay();
  const panel = windows.overlay();
  windows.presentOnboarding(panel, true);
  windows.presentOnboarding(main, true);
  assert.equal(main.isVisible(), false);
  assert.equal(panel.isVisible(), true);
});

test('onboarding in the workspace hides the separate session panel as well', () => {
  const { windows } = harness();
  const main = windows.openMain();
  main.emit('ready-to-show');
  assert.equal(main.isVisible(), true);
  windows.showOverlay();
  windows.setOverlayExpanded(windows.overlay(), true);
  windows.presentOnboarding(main, true);
  assert.equal(windows.overlay().isVisible(), false);
  assert.equal(windows.bar().isVisible(), false);
  assert.equal(windows.listening().active, false);
});
