const { test } = require('node:test');
const assert = require('node:assert/strict');
const { windowFanOut } = require('../src/main/infrastructure/electron/fan-out.cjs');

function fakeWindow(name, log, { destroyed = false, contentsId = 0 } = {}) {
  return {
    name,
    isDestroyed: () => destroyed,
    webContents: {
      id: contentsId,
      isDestroyed: () => destroyed,
      send: (channel, payload) => log.push([name, channel, payload]),
    },
  };
}

function fixture() {
  const log = [];
  const main = fakeWindow('main', log, { contentsId: 1 }),
    overlay = fakeWindow('overlay', log, { contentsId: 2 }),
    notch = fakeWindow('notch', log, { contentsId: 3 }),
    bar = fakeWindow('bar', log, { contentsId: 5 }),
    closed = fakeWindow('closed', log, { destroyed: true, contentsId: 4 });
  const fanOut = windowFanOut({
    BrowserWindow: { getAllWindows: () => [main, overlay, notch, closed] },
    windows: { overlay: () => overlay, bar: () => bar, notch: () => notch },
  });
  return { log, fanOut };
}
const names = (log) => log.map(([name]) => name);

test('a broadcast reaches every open window', () => {
  const { log, fanOut } = fixture();
  fanOut.broadcast('workspace:changed', 1);
  assert.deepEqual(names(log), ['main', 'overlay', 'notch']);
});

test('insight streams reach the panel and the bar but skip the Notch; other modes reach it', () => {
  const { log, fanOut } = fixture();
  fanOut.overlayDelta({}, 'insight');
  assert.deepEqual(names(log.splice(0)), ['overlay', 'bar']);
  fanOut.overlayDelta({}, 'chat');
  assert.deepEqual(names(log.splice(0)), ['overlay', 'bar', 'notch']);
  fanOut.answer({}, 'insight');
  fanOut.finished({}, 'insight');
  assert.deepEqual(
    log.splice(0).map(([name, channel]) => `${name} ${channel}`),
    ['main overlay:answer', 'overlay overlay:answer', 'main overlay:finished', 'overlay overlay:finished'],
  );
  fanOut.answer({}, 'chat');
  assert.deepEqual(names(log), ['main', 'overlay', 'notch']);
});

test('owner events reach only the live window with that web contents id', () => {
  const { log, fanOut } = fixture();
  fanOut.toOwner(2, 'voice:stopped', { voiceId: 'v' });
  fanOut.toOwner(4, 'voice:stopped', { voiceId: 'gone' });
  fanOut.toOwner(9, 'voice:stopped', { voiceId: 'unknown' });
  assert.deepEqual(log, [['overlay', 'voice:stopped', { voiceId: 'v' }]]);
  const sent = [];
  fanOut.toSender({ isDestroyed: () => false, send: (...args) => sent.push(args) }, 'ai:delta', 1);
  fanOut.toSender({ isDestroyed: () => true, send: (...args) => sent.push(args) }, 'ai:delta', 2);
  assert.deepEqual(sent, [['ai:delta', 1]]);
});

test('a hidden recorder transfers feedback to exactly one visible surface, preferring the open panel', () => {
  const log = [];
  const main = fakeWindow('main', log),
    panel = fakeWindow('panel', log),
    bar = fakeWindow('bar', log);
  const state = { panel: true, focused: null, bar: true, main: false };
  main.isVisible = () => state.main;
  panel.isVisible = () => state.panel;
  bar.isVisible = () => state.bar;
  const fanOut = windowFanOut({
    BrowserWindow: { getAllWindows: () => [main, panel, bar], getFocusedWindow: () => state.focused },
    windows: { overlay: () => panel, bar: () => bar, panelVisible: () => state.panel, notch: () => null },
  });
  fanOut.toVisible(main.webContents, 'integration:error', 'Blocked');
  assert.deepEqual(log.splice(0), [['panel', 'integration:error', 'Blocked']]);
  state.panel = false;
  fanOut.toVisible(main.webContents, 'integration:error', 'Blocked');
  assert.deepEqual(log.splice(0), [['bar', 'integration:error', 'Blocked']]);
  state.focused = main;
  state.main = true;
  fanOut.toVisible(main.webContents, 'integration:error', 'Blocked');
  assert.deepEqual(log.splice(0), [['main', 'integration:error', 'Blocked']]);
  state.focused = null;
  state.main = false;
  state.bar = false;
  fanOut.toVisible(main.webContents, 'integration:error', 'Blocked');
  assert.deepEqual(log, []);
});
