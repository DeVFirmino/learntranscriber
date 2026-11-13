const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createShortcutDelivery } = require('../src/main/interface/desktop/shortcut-delivery.cjs');

function harness() {
  const sent = [],
    calls = [],
    loaded = [];
  const state = { loading: true, destroyed: false, visible: true, panel: true, expanded: false };
  const window = {
    isDestroyed: () => state.destroyed,
    isVisible: () => state.visible,
    focus: () => calls.push('focus'),
    webContents: {
      send: (...args) => sent.push(args),
      isLoadingMainFrame: () => state.loading,
      once: (event, callback) => loaded.push({ event, callback }),
    },
  };
  const delivery = createShortcutDelivery({
    windows: {
      open: (value) => Boolean(value && !value.isDestroyed()),
      ensureMain: () => window,
      showOverlay: () => calls.push('show'),
      overlay: () => window,
      notch: () => null,
      bar: () => window,
      barVisible: () => state.visible,
      panelVisible: () => state.panel,
      overlayExpanded: () => state.expanded,
      setOverlayExpanded: (_window, value) => {
        state.expanded = value;
        calls.push('expand');
      },
      nudgePanel: (...args) => calls.push(args),
    },
  });
  return { delivery, sent, calls, loaded, state };
}

test('analysis waits for the panel renderer, then focuses and delivers once without using the recorder', () => {
  const h = harness();
  assert.equal(h.delivery.assistant('analyze'), true);
  assert.deepEqual(h.calls, ['show', 'expand']);
  assert.deepEqual(h.sent, []);
  assert.equal(h.loaded.length, 1);
  assert.equal(h.loaded[0].event, 'did-finish-load');
  h.loaded[0].callback();
  assert.deepEqual(h.calls, ['show', 'expand', 'focus']);
  assert.deepEqual(h.sent, [['workspace:action', 'analyze']]);
});

test('a window destroyed during loading receives no command or focus', () => {
  for (const target of ['assistant', 'main']) {
    const h = harness();
    h.delivery[target]('record');
    h.state.destroyed = true;
    h.loaded[0].callback();
    assert.deepEqual(h.sent, []);
    assert.ok(!h.calls.includes('focus'));
  }
});

test('hidden surfaces do not receive scroll, bar or nudge commands', () => {
  const h = harness();
  h.state.panel = false;
  h.state.visible = false;
  assert.equal(h.delivery.scroll('scrollDown'), false);
  assert.equal(h.delivery.bar('escape'), false);
  assert.equal(h.delivery.nudge(30, 0), false);
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.sent, []);
});
