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

test('an error from one window reaches every other open window', () => {
  const log = [];
  const main = fakeWindow('main', log, { contentsId: 1 }),
    overlay = fakeWindow('overlay', log, { contentsId: 2 }),
    bar = fakeWindow('bar', log, { contentsId: 5 }),
    closed = fakeWindow('closed', log, { destroyed: true, contentsId: 4 });
  const fanOut = windowFanOut({
    BrowserWindow: { getAllWindows: () => [main, overlay, bar, closed] },
    windows: { overlay: () => overlay, bar: () => bar, notch: () => null },
  });
  fanOut.toOthers(main.webContents, 'integration:error', 'Failed');
  assert.deepEqual(log, [
    ['overlay', 'integration:error', 'Failed'],
    ['bar', 'integration:error', 'Failed'],
  ]);
});
