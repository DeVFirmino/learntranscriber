const { test } = require('node:test');
const assert = require('node:assert/strict');
const { quitHandshake } = require('../src/main/infrastructure/electron/quit-handshake.cjs');

test('quitting waits for the workspace to flush its recordings', async () => {
  const sent = [],
    logged = [];
  const window = { isDestroyed: () => false, webContents: { send: (channel) => sent.push(channel) } };
  const handshake = quitHandshake({ main: () => window, log: (message) => logged.push(message) });
  let flushed = false;
  const flushing = handshake.flush().then(() => (flushed = true));
  await Promise.resolve();
  assert.deepEqual(sent, ['app:prepare-quit']);
  assert.equal(flushed, false);
  handshake.ready({ discardedSegments: 2 });
  await flushing;
  assert.equal(flushed, true);
  assert.match(logged[0], /2 recorded segment\(s\) could not be transcribed/);
  assert.doesNotThrow(() => handshake.ready());
});

test('without a workspace window the flush finishes at once', async () => {
  await quitHandshake({ main: () => null }).flush();
  await quitHandshake({ main: () => ({ isDestroyed: () => true }) }).flush();
});
