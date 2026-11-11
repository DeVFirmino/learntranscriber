const { test } = require('node:test');
const assert = require('node:assert/strict');
const { senderTrust } = require('../src/main/interface/ipc/trusted-sender.cjs');

const RENDERER = 'file:///app/ui/dist/index.html';

function fixture() {
  const mainFrame = { url: RENDERER };
  const sender = { mainFrame };
  const window = { id: 1 };
  const windows = new Map([[sender, window]]);
  const registered = new Set([window]);
  const trusted = senderTrust({
    BrowserWindow: { fromWebContents: (contents) => windows.get(contents) },
    registered: (candidate) => registered.has(candidate),
    rendererUrl: RENDERER,
  });
  return { trusted, sender, mainFrame, registered, window };
}
const REFUSED = /did not originate from an application window/;

test('the renderer top frame of a registered window is trusted, with any hash or query', () => {
  const { trusted, sender, mainFrame } = fixture();
  assert.doesNotThrow(() => trusted({ sender, senderFrame: mainFrame }));
  mainFrame.url = `${RENDERER}?role=overlay#settings`;
  assert.doesNotThrow(() => trusted({ sender, senderFrame: mainFrame }));
});

test('unknown senders, unregistered windows, subframes and other pages are refused', () => {
  const { trusted, sender, mainFrame, registered, window } = fixture();
  assert.throws(() => trusted({ sender: { mainFrame }, senderFrame: mainFrame }), REFUSED);
  assert.throws(() => trusted({ sender, senderFrame: { url: RENDERER } }), REFUSED);
  mainFrame.url = 'https://example.com/index.html';
  assert.throws(() => trusted({ sender, senderFrame: mainFrame }), REFUSED);
  mainFrame.url = RENDERER;
  registered.delete(window);
  assert.throws(() => trusted({ sender, senderFrame: mainFrame }), REFUSED);
});
