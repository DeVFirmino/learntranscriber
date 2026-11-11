const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { guardWindow } = require('../src/main/infrastructure/electron/window-guards.cjs');
const { createSettingsRoute } = require('../src/main/infrastructure/electron/settings-route.cjs');

const renderer = { url: 'file:///app/index.html' };
function fakeWindow(url = renderer.url) {
  const window = new EventEmitter();
  window.webContents = new EventEmitter();
  window.webContents.getURL = () => url;
  window.webContents.setWindowOpenHandler = (handler) => (window.openHandler = handler);
  return window;
}
const event = () => ({
  prevented: false,
  preventDefault() {
    this.prevented = true;
  },
});

test('windows refuse popups, webviews and navigation away from the bundled renderer', () => {
  const window = fakeWindow();
  guardWindow(window, { renderer, isQuitting: () => false });
  assert.deepEqual(window.openHandler(), { action: 'deny' });
  const away = event(),
    inside = event(),
    webview = event();
  window.webContents.emit('will-navigate', away, 'https://example.com/');
  window.webContents.emit('will-navigate', inside, `${renderer.url}?window=main#settings`);
  window.webContents.emit('will-attach-webview', webview);
  assert.deepEqual([away.prevented, inside.prevented, webview.prevented], [true, false, true]);
});

test('the unload guard holds the window only until quit begins', () => {
  let quitting = false;
  const window = fakeWindow();
  guardWindow(window, { renderer, isQuitting: () => quitting });
  const before = event();
  window.webContents.emit('will-prevent-unload', before);
  quitting = true;
  const during = event();
  window.webContents.emit('will-prevent-unload', during);
  assert.deepEqual([before.prevented, during.prevented], [false, true]);
});

test('only the shortcut editor opens and closes with the workspace route and closes with the window', () => {
  const changes = [];
  const route = createSettingsRoute({ renderer, onChange: (open) => changes.push(open) });
  const window = fakeWindow(`${renderer.url}#settings/shortcuts`);
  route.watch(window);
  window.webContents.emit('did-navigate-in-page', {}, `${renderer.url}#settings`, true);
  window.webContents.emit('did-navigate-in-page', {}, `${renderer.url}#settings/audio`, true);
  assert.deepEqual(changes, [], 'general and audio settings keep global shortcuts available');
  window.webContents.emit('did-navigate-in-page', {}, `${renderer.url}#settings/shortcuts`, true);
  window.webContents.emit('did-navigate-in-page', {}, 'https://example.com/#settings', true);
  window.webContents.emit('did-navigate-in-page', {}, `${renderer.url}#home`, false);
  window.webContents.emit('did-navigate', {}, `${renderer.url}#home`);
  window.emit('show');
  window.emit('hide');
  window.emit('show');
  window.webContents.emit('did-start-loading');
  route.close();
  assert.deepEqual(changes, [true, false, true, false, true, false]);
});
