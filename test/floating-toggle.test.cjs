const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createWindows } = require('../src/main/infrastructure/electron/windows.cjs');

function harness() {
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
    loadURL() {}
  }
  Window.nextId = 1;
  const area = { x: 0, y: 32, width: 1512, height: 950 };
  // The PrivacyController concealment contract: hide what is visible, remember it and bring it back on restore.
  const privacy = {
    concealed: false,
    targets: new Set(),
    windows: [],
    register(window) {
      this.windows.push(window);
    },
    show(window) {
      if (this.concealed) return false;
      window.visible = true;
      return true;
    },
    conceal() {
      this.concealed = true;
      for (const window of this.windows)
        if (window.visible) {
          this.targets.add(window);
          window.visible = false;
        }
    },
    restore() {
      this.concealed = false;
      for (const window of this.targets) window.visible = true;
      this.targets.clear();
    },
    willRestore(window) {
      return this.targets.has(window);
    },
    setRestore(window, included) {
      if (included) this.targets.add(window);
      else this.targets.delete(window);
    },
  };
  const windows = createWindows({
    BrowserWindow: Window,
    screen: { getPrimaryDisplay: () => ({ workArea: area }), getDisplayMatching: () => ({ workArea: area }) },
    privacy: () => privacy,
    settings: () => ({ notchEnabled: false }),
    active: { id: () => 'session' },
    notchState: {},
    renderer: { path: '/renderer.html', url: 'file:///renderer.html' },
    preload: '/preload.cjs',
    isQuitting: () => false,
    onOwnerClosing() {},
    onOwnerDestroyed() {},
    changed() {},
  });
  return { windows, privacy };
}

test('the floating toggle while hidden changes what returns on restore and reveals nothing', () => {
  const { windows, privacy } = harness();
  windows.showOverlay();
  windows.setOverlayExpanded(windows.overlay(), true);
  privacy.conceal();
  windows.toggleOverlay();
  assert.equal(windows.bar().isVisible(), false);
  assert.equal(windows.overlay().isVisible(), false);
  privacy.restore();
  assert.equal(windows.bar().isVisible(), false, 'toggled off while hidden');
  assert.equal(windows.overlay().isVisible(), false);
  privacy.conceal();
  windows.toggleOverlay();
  assert.equal(windows.bar().isVisible(), false, 'still hidden after toggling back on');
  privacy.restore();
  assert.equal(windows.bar().isVisible(), true);
  assert.equal(windows.overlay().isVisible(), true, 'the expanded panel returns with the bar');
});

test('panel slides keep the recording bar fixed and report the panel only while it is shown', () => {
  const { windows, privacy } = harness();
  windows.showOverlay();
  assert.equal(windows.panelVisible(), false, 'collapsed');
  windows.setOverlayExpanded(windows.overlay(), true);
  assert.equal(windows.panelVisible(), true);
  const bar = windows.bar().getBounds(),
    panel = windows.overlay().getBounds();
  windows.nudgePanel(-30, 0);
  windows.nudgePanel(0, -30);
  assert.deepEqual(windows.bar().getBounds(), bar);
  assert.deepEqual(windows.overlay().getBounds(), { ...panel, x: panel.x - 30, y: panel.y - 30 });
  privacy.conceal();
  assert.equal(windows.panelVisible(), false, 'hidden');
});
