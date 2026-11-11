const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createNotchState } = require('../src/main/application/runtime/notch-state.cjs');
const { createNotchPlacement } = require('../src/main/application/notch/placement.cjs');
const { createIpcRegistrar } = require('../src/main/interface/ipc/register.cjs');
const { registerNotch } = require('../src/main/interface/ipc/notch.cjs');

function harness() {
  const notch = {},
    main = {},
    saved = [],
    calls = { expanded: [], changes: 0 };
  let bounds = { x: 600, y: 0, width: 240, height: 48 };
  const view = { visible: true, concealed: false };
  const window = {
    owns: (event) => event.sender === notch,
    registeredAsNotch: () => true,
    visible: () => view.visible,
    concealed: () => view.concealed,
    bounds: () => bounds,
    setBounds: (value) => {
      bounds = value;
    },
    workArea: () => ({ x: 0, y: 0, width: 1440, height: 900 }),
    setInteractive: (active) => active,
  };
  const state = createNotchState({ now: () => 5000 });
  const settings = { notchWidth: 360, notchPinned: false };
  const handlers = new Map();
  const handle = createIpcRegistrar({
    ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) },
    trusted: () => {},
    accepts: () => true,
  });
  registerNotch(handle, {
    window,
    state,
    activeId: () => 's1',
    changed: () => calls.changes++,
    expand: (value) => {
      calls.expanded.push(value);
      state.setExpanded(value);
    },
    placement: createNotchPlacement({
      window,
      state,
      settings: () => settings,
      saveSettings: (patch) => saved.push(patch),
    }),
  });
  const call = (sender, channel, input) => handlers.get(channel)({ sender }, input);
  return { notch, main, saved, calls, view, state, call, bounds: () => bounds };
}

test('only the Notch window may use Notch channels', async () => {
  const { main, call, calls } = harness();
  for (const [channel, input] of [
    ['notch:expand', true],
    ['notch:interactive', true],
    ['notch:insight-displayed', 'r1'],
  ])
    assert.equal((await call(main, channel, input)).ok, false, channel);
  assert.equal(
    (await call(main, 'notch:move', { x: 1, y: 1, commit: false })).error,
    'Notch is unavailable for movement.',
  );
  assert.deepEqual(calls.expanded, []);
});

test('a hidden or concealed Notch does not expand, move or resize', async () => {
  const { notch, view, state, call, calls } = harness();
  view.concealed = true;
  assert.deepEqual(await call(notch, 'notch:expand', true), { ok: true, value: false });
  assert.equal((await call(notch, 'notch:move', { x: 1, y: 1, commit: true })).ok, false);
  view.concealed = false;
  state.setExpanded(false);
  assert.equal(
    (await call(notch, 'notch:resize', { width: 500, height: 300, commit: true })).error,
    'Notch is unavailable for resizing.',
  );
  assert.deepEqual(calls.expanded, []);
});

test('dragging moves the window and only a commit saves the placement', async () => {
  const { notch, saved, call } = harness();
  assert.equal((await call(notch, 'notch:move', { x: 700, y: 40, commit: false })).ok, true);
  assert.deepEqual(saved, []);
  const committed = await call(notch, 'notch:move', { x: 700, y: 40, commit: true });
  assert.equal(committed.ok, true);
  assert.equal(saved.length, 1);
  assert.ok('notchPinned' in saved[0] && 'notchX' in saved[0] && 'notchY' in saved[0]);
});

test('an acknowledgement publishes once only when the pending answer was seen', async () => {
  const { notch, state, call, calls } = harness();
  state.offer(
    { requestId: 'r1', sessionId: 's1', answer: 'Answer.', automatic: false, activeId: 's1', notchOpen: true },
    () => {},
  );
  assert.deepEqual(await call(notch, 'notch:insight-displayed', 'r1'), { ok: true, value: false });
  await call(notch, 'notch:expand', true);
  assert.deepEqual(await call(notch, 'notch:insight-displayed', 'r1'), { ok: true, value: true });
  assert.equal((await call(notch, 'notch:insight-displayed', '')).error, 'Invalid display acknowledgement.');
  assert.equal(calls.changes, 1);
});
