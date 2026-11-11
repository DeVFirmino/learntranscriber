const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PrivacyController } = require('../src/main/infrastructure/electron/privacy.cjs');
const { DEFAULTS } = require('../src/main/domain/settings/defaults.cjs');

function windowFixture(emitHide = true) {
  const calls = [],
    events = {};
  let visible = false,
    destroyed = false;
  const window = {
    calls,
    on: (event, fn) => (events[event] = fn),
    emit: (event, ...args) => events[event]?.(...args),
    once: (event, fn) => (events[event] = fn),
    isDestroyed: () => destroyed,
    isVisible: () => visible,
    show: () => {
      visible = true;
      calls.push(['show']);
    },
    showInactive: () => {
      visible = true;
      calls.push(['showInactive']);
    },
    hide: () => {
      visible = false;
      calls.push(['hide']);
      if (emitHide) events.hide?.();
    },
    focus: () => {},
    destroy: () => {
      destroyed = true;
      events.closed?.();
    },
  };
  for (const name of [
    'setContentProtection',
    'setSkipTaskbar',
    'setTitle',
    'setAlwaysOnTop',
    'setVisibleOnAllWorkspaces',
    'setOpacity',
    'setIgnoreMouseEvents',
  ])
    window[name] = (...args) => calls.push([name, ...args]);
  return window;
}
test('capture protection applies to existing and newly registered windows before they are shown', () => {
  const privacy = new PrivacyController({}, DEFAULTS, 'darwin');
  const main = windowFixture();
  privacy.register(main, 'main');
  assert.deepEqual(main.calls[0], ['setContentProtection', true]);
  privacy.update({ ...DEFAULTS, captureProtection: false });
  const overlay = windowFixture();
  privacy.register(overlay, 'overlay');
  assert.deepEqual(overlay.calls[0], ['setContentProtection', false]);
  assert.ok(main.calls.some(([name, value]) => name === 'setContentProtection' && value === false));
});
test('concealment resists window creation, setting updates and asynchronous re-show requests', () => {
  const privacy = new PrivacyController({}, DEFAULTS, 'darwin');
  const main = windowFixture(),
    overlay = windowFixture(),
    alreadyHidden = windowFixture();
  privacy.register(main, 'main');
  privacy.register(overlay, 'overlay');
  privacy.register(alreadyHidden, 'overlay');
  privacy.show(main);
  privacy.show(overlay, false);
  privacy.conceal();
  assert.equal(main.isVisible(), false);
  assert.equal(overlay.isVisible(), false);
  privacy.update({ ...DEFAULTS, overlayOpacity: 0.7 });
  const late = windowFixture();
  privacy.register(late, 'overlay');
  assert.equal(privacy.show(late), false);
  assert.equal(privacy.show(main), false);
  overlay.destroy();
  privacy.restore();
  assert.equal(main.isVisible(), true);
  assert.equal(alreadyHidden.isVisible(), false);
  assert.equal(late.isVisible(), false);
});
test('click-through and opacity are isolated to the floating assistant; Dock has a reversible control', async () => {
  const dock = [],
    app = { dock: { hide: () => dock.push('accessory'), show: async () => dock.push('regular') } };
  const privacy = new PrivacyController(app, DEFAULTS, 'darwin');
  const main = windowFixture(),
    overlay = windowFixture();
  privacy.register(main, 'main');
  privacy.register(overlay, 'overlay');
  privacy.update({ ...DEFAULTS, hideDock: true, overlayClickThrough: true, overlayOpacity: 0.5 });
  assert.ok(overlay.calls.some(([name, value]) => name === 'setIgnoreMouseEvents' && value === true));
  assert.ok(overlay.calls.some(([name, value]) => name === 'setOpacity' && value === 1));
  assert.equal(
    main.calls.some(([name]) => name === 'setIgnoreMouseEvents'),
    false,
  );
  await new Promise((resolve) => setTimeout(resolve, 5));
  privacy.update({ ...DEFAULTS, hideDock: false, overlayClickThrough: false });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(dock, ['accessory', 'regular']);
});

test('stealth mode forces protection and hidden identity without overwriting individual preferences', async () => {
  const policies = [],
    privacy = new PrivacyController(
      { dock: { hide: () => policies.push('accessory'), show: async () => policies.push('regular') } },
      { ...DEFAULTS, captureProtection: false, hideDock: false },
      'darwin',
    );
  const main = windowFixture();
  privacy.register(main, 'main');
  privacy.update({ ...DEFAULTS, captureProtection: false, hideDock: false, stealthMode: true });
  assert.equal(main.calls.findLast(([name]) => name === 'setContentProtection')[1], true);
  assert.equal(main.calls.findLast(([name]) => name === 'setSkipTaskbar')[1], true);
  assert.equal(main.calls.findLast(([name]) => name === 'setTitle')[1], '');
  assert.equal(privacy.settings.captureProtection, false);
  assert.equal(privacy.settings.hideDock, false);
  await new Promise((resolve) => setTimeout(resolve, 5));
  privacy.update({ ...DEFAULTS, captureProtection: false, hideDock: false, stealthMode: false });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(main.calls.findLast(([name]) => name === 'setContentProtection')[1], false);
  assert.equal(main.calls.findLast(([name]) => name === 'setTitle')[1], 'LearnTranscriber');
  assert.deepEqual(policies, ['accessory', 'regular']);
});
test('page titles cannot restore identity and focus/restore reassert capture protection', () => {
  const privacy = new PrivacyController({}, { ...DEFAULTS, stealthMode: true }, 'darwin'),
    main = windowFixture();
  privacy.register(main, 'main');
  let prevented = false;
  main.emit(
    'page-title-updated',
    {
      preventDefault() {
        prevented = true;
      },
    },
    'Private session title',
  );
  assert.equal(prevented, true);
  assert.equal(main.calls.findLast(([name]) => name === 'setTitle')[1], '');
  for (const event of ['focus', 'restore', 'show']) {
    main.calls.length = 0;
    main.emit(event);
    assert.deepEqual(main.calls[0], ['setContentProtection', true]);
  }
});
test('new windows inherit stealth while concealment remains authoritative', () => {
  const privacy = new PrivacyController({}, { ...DEFAULTS, stealthMode: true }, 'darwin');
  privacy.conceal();
  const late = windowFixture();
  privacy.register(late, 'overlay');
  assert.deepEqual(late.calls[0], ['setContentProtection', true]);
  assert.equal(late.calls.findLast(([name]) => name === 'setTitle')[1], '');
  assert.equal(privacy.show(late), false);
  assert.equal(late.isVisible(), false);
  privacy.restore();
  assert.equal(late.isVisible(), false);
  assert.equal(privacy.status().stealthMode, true);
});

test('hiding the menu icon requires a working restore shortcut', () => {
  const { menuBarState } = require('../src/main/domain/overlay/menu-bar.cjs');
  assert.deepEqual(menuBarState({ showMenuBarIcon: false }, false), { visible: true, recoveryFallback: true });
  assert.deepEqual(menuBarState({ showMenuBarIcon: false }, true), { visible: false, recoveryFallback: false });
  assert.deepEqual(menuBarState({ showMenuBarIcon: true }, false), { visible: true, recoveryFallback: false });
});

test('Notch hover interaction survives privacy updates and remains independent from overlay click-through', () => {
  const privacy = new PrivacyController({}, DEFAULTS, 'darwin'),
    notch = windowFixture(),
    overlay = windowFixture();
  privacy.register(notch, 'notch');
  privacy.register(overlay, 'overlay');
  privacy.show(notch, false);
  assert.deepEqual(
    notch.calls.findLast(([name]) => name === 'setIgnoreMouseEvents'),
    ['setIgnoreMouseEvents', true, { forward: true }],
  );
  assert.equal(privacy.setNotchInteractive(notch, true), true);
  privacy.update({ ...DEFAULTS, overlayClickThrough: true, overlayOpacity: 0.7 });
  assert.equal(notch.calls.findLast(([name]) => name === 'setIgnoreMouseEvents')[1], false);
  assert.equal(overlay.calls.findLast(([name]) => name === 'setIgnoreMouseEvents')[1], true);
  assert.equal(privacy.setNotchInteractive(overlay, true), false);
  assert.equal(privacy.setNotchInteractive(notch, false), true);
  assert.equal(notch.calls.findLast(([name]) => name === 'setIgnoreMouseEvents')[1], true);
});

test('hidden and concealed Notch windows drop interaction and cannot reactivate it', () => {
  const privacy = new PrivacyController({}, DEFAULTS, 'darwin'),
    notch = windowFixture();
  privacy.register(notch, 'notch');
  assert.equal(privacy.setNotchInteractive(notch, true), false);
  privacy.show(notch, false);
  privacy.setNotchInteractive(notch, true);
  notch.hide();
  assert.equal(notch.calls.findLast(([name]) => name === 'setIgnoreMouseEvents')[1], true);
  privacy.show(notch, false);
  assert.equal(notch.calls.findLast(([name]) => name === 'setIgnoreMouseEvents')[1], true);
  privacy.setNotchInteractive(notch, true);
  privacy.conceal();
  assert.equal(privacy.setNotchInteractive(notch, true), false);
  privacy.restore();
  assert.equal(notch.calls.findLast(([name]) => name === 'setIgnoreMouseEvents')[1], true);
});

test('controller hide clears Notch interaction even without a native hide event', () => {
  const privacy = new PrivacyController({}, DEFAULTS, 'darwin'),
    notch = windowFixture(false);
  privacy.register(notch, 'notch');
  privacy.show(notch, false);
  privacy.setNotchInteractive(notch, true);
  privacy.hide(notch);
  assert.equal(notch.isVisible(), false);
  assert.equal(privacy.notchInteractive.has(notch), false);
  assert.equal(notch.calls.findLast(([name]) => name === 'setIgnoreMouseEvents')[1], true);
  privacy.show(notch, false);
  privacy.setNotchInteractive(notch, true);
  privacy.conceal();
  privacy.restore();
  assert.equal(privacy.notchInteractive.has(notch), false);
  assert.equal(notch.calls.findLast(([name]) => name === 'setIgnoreMouseEvents')[1], true);
});
test('floating text stays opaque while Notch opacity remains independent', () => {
  const privacy = new PrivacyController({}, DEFAULTS, 'darwin');
  const overlay = windowFixture(),
    notch = windowFixture();
  privacy.register(overlay, 'overlay');
  privacy.register(notch, 'notch');
  privacy.update({ ...DEFAULTS, overlayOpacity: 0.5, notchOpacity: 0.8 });
  assert.equal(overlay.calls.findLast(([name]) => name === 'setOpacity')[1], 1);
  assert.equal(notch.calls.findLast(([name]) => name === 'setOpacity')[1], 0.8);
});

test('leaving stealth returns before Dock restoration and later privacy updates remain responsive', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10_000 });
  const calls = [];
  let resolveShow;
  const app = {
    setActivationPolicy: () => {
      throw new Error('Do not enter synchronous AppKit activation from IPC.');
    },
    dock: {
      hide: () => calls.push('hide'),
      show: () => {
        calls.push('show');
        return new Promise((resolve) => {
          resolveShow = resolve;
        });
      },
    },
  };
  const privacy = new PrivacyController(app, { ...DEFAULTS, stealthMode: true }, 'darwin');
  const main = windowFixture(),
    overlay = windowFixture();
  privacy.register(main, 'main');
  privacy.register(overlay, 'overlay');
  privacy.update({ ...DEFAULTS, stealthMode: false, captureProtection: false });
  assert.deepEqual(calls, [], 'settings IPC can publish its result before a native Dock transition');
  t.mock.timers.tick(0);
  assert.deepEqual(calls, ['show']);
  privacy.update({ ...DEFAULTS, stealthMode: true });
  assert.equal(privacy.status().stealthMode, true, 'a pending Dock promise does not block another request');
  resolveShow();
  // The bounded wait on dock.show() settles a few microtasks after the show itself.
  for (let i = 0; i < 4; i++) await Promise.resolve();
  t.mock.timers.tick(999);
  assert.deepEqual(calls, ['show'], 'Electron ignores hides within one second of showing the Dock');
  t.mock.timers.tick(1);
  assert.deepEqual(calls, ['show', 'hide'], 'the newest setting wins after restoration');
});

test('native focus events cannot reenter a window privacy update', () => {
  const privacy = new PrivacyController({}, DEFAULTS, 'darwin');
  const overlay = windowFixture();
  privacy.register(overlay, 'overlay');
  let calls = 0;
  overlay.setAlwaysOnTop = () => {
    calls++;
    overlay.emit('focus');
  };
  privacy.update({ ...DEFAULTS, stealthMode: false });
  assert.equal(calls, 1);
});

test('a Dock that is already visible is not shown again, so stealth hides it at once', async () => {
  const dock = [];
  const privacy = new PrivacyController(
    { dock: { isVisible: () => true, hide: () => dock.push('hide'), show: async () => dock.push('show') } },
    DEFAULTS,
    'darwin',
  );
  privacy.update({ ...DEFAULTS });
  await new Promise((resolve) => setTimeout(resolve, 5));
  privacy.update({ ...DEFAULTS, stealthMode: true });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(dock, ['hide']);
});

test('a dock.show() that never settles does not block a later hide', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const dock = [];
  const privacy = new PrivacyController(
    {
      dock: {
        isVisible: () => false,
        hide: () => dock.push('hide'),
        show: () => {
          dock.push('show');
          return new Promise(() => {});
        },
      },
    },
    { ...DEFAULTS, hideDock: true },
    'darwin',
  );
  privacy.update({ ...DEFAULTS, hideDock: false });
  t.mock.timers.tick(0);
  await Promise.resolve();
  privacy.update({ ...DEFAULTS, hideDock: true });
  for (let i = 0; i < 6; i++) {
    t.mock.timers.tick(500);
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.deepEqual(dock, ['show', 'hide']);
});

test('a hide that AppKit ignores is repeated until the Dock icon is gone', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  let visible = true,
    hides = 0;
  const privacy = new PrivacyController(
    {
      dock: {
        isVisible: () => visible,
        hide: () => {
          hides++;
          if (hides >= 3) visible = false;
        },
        show: async () => {},
      },
    },
    DEFAULTS,
    'darwin',
  );
  privacy.update({ ...DEFAULTS, hideDock: true });
  for (let i = 0; i < 10; i++) {
    t.mock.timers.tick(250);
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(visible, false);
  assert.equal(hides, 3);
});
