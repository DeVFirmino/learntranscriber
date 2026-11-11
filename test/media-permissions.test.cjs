const { test } = require('node:test');
const assert = require('node:assert/strict');
const { configureMediaPermissions } = require('../src/main/infrastructure/electron/permissions.cjs');

const RENDERER = 'app://renderer/index.html';

// The details below have the shapes Electron 45 passes for getUserMedia, getDisplayMedia and enumerateDevices on the
// app:// page, as recorded from those calls with every request denied.
function fixture({ mediaSource = async () => ({ id: 'screen:1' }) } = {}) {
  const handlers = {};
  const contents = { id: 'owned' };
  const window = { id: 1 };
  const windows = new Map([[contents, window]]);
  configureMediaPermissions({
    session: {
      setPermissionRequestHandler: (handler) => (handlers.request = handler),
      setPermissionCheckHandler: (handler) => (handlers.check = handler),
      setDisplayMediaRequestHandler: (handler) => (handlers.display = handler),
    },
    privacy: { windows: new Set([window]) },
    BrowserWindow: { fromWebContents: (candidate) => windows.get(candidate) ?? null },
    rendererUrl: RENDERER,
    mediaSource,
  });
  const request = (permission, details, from = contents) => {
    let granted;
    handlers.request(from, permission, (value) => (granted = value), details);
    return granted;
  };
  const check = (permission, details, from = contents) => handlers.check(from, permission, 'app://renderer/', details);
  const display = (url) => new Promise((resolve) => handlers.display({ frame: { url } }, resolve));
  return { request, check, display };
}

const topFrame = (extra) => ({
  isMainFrame: true,
  requestingUrl: `${RENDERER}?window=bar`,
  securityOrigin: 'app://renderer/',
  ...extra,
});

test('the microphone is granted to the renderer top frame of an owned window', () => {
  const { request } = fixture();
  assert.equal(request('media', topFrame({ mediaTypes: ['audio'] })), true);
});

test('the camera is refused, alone or with the microphone, and so is a media request that names no type', () => {
  const { request } = fixture();
  assert.equal(request('media', topFrame({ mediaTypes: ['video'] })), false);
  assert.equal(request('media', topFrame({ mediaTypes: ['audio', 'video'] })), false);
  assert.equal(request('media', topFrame({ mediaTypes: [] })), false);
  assert.equal(request('media', topFrame({ mediaTypes: undefined })), false);
});

test('screen capture with its audio is granted to the renderer top frame', () => {
  const { request } = fixture();
  assert.equal(request('display-capture', topFrame({ mediaTypes: ['audio', 'video'] })), true);
});

test('child frames, other pages, windows the app does not own and missing details are refused', () => {
  const { request } = fixture();
  const audio = { mediaTypes: ['audio'] };
  assert.equal(
    request('media', topFrame({ ...audio, isMainFrame: false, requestingUrl: 'app://renderer/child.html' })),
    false,
  );
  assert.equal(request('media', topFrame({ ...audio, requestingUrl: 'https://example.test/index.html' })), false);
  assert.equal(request('media', topFrame({ ...audio, requestingUrl: 'app://renderer/other.html' })), false);
  assert.equal(request('media', topFrame(audio), { id: 'foreign' }), false);
  assert.equal(request('media', undefined), false);
  assert.equal(request('display-capture', topFrame({ isMainFrame: false })), false);
});

test('permissions other than media and display capture are refused, even for the renderer', () => {
  const { request, check } = fixture();
  for (const permission of ['geolocation', 'notifications', 'clipboard-read', 'openExternal', 'speaker-selection'])
    assert.equal(request(permission, topFrame()), false, permission);
  assert.equal(check('geolocation', topFrame()), false);
});

test('checks answer yes only for microphone audio and display capture from the renderer top frame', () => {
  const { check } = fixture();
  assert.equal(check('media', topFrame({ mediaType: 'audio' })), true);
  assert.equal(check('media', topFrame({ mediaType: 'video' })), false);
  assert.equal(check('media', topFrame({ mediaType: 'unknown' })), false);
  assert.equal(check('display-capture', topFrame()), true);
  assert.equal(check('media', topFrame({ mediaType: 'audio', requestingUrl: undefined })), false);
  assert.equal(check('media', topFrame({ mediaType: 'audio', isMainFrame: false })), false);
  assert.equal(check('media', topFrame({ mediaType: 'audio' }), null), false);
});

test('display media goes to the renderer page with system audio as loopback, and nowhere else', async () => {
  const { display } = fixture();
  assert.deepEqual(await display(`${RENDERER}?window=bar#x`), { video: { id: 'screen:1' }, audio: 'loopback' });
  assert.deepEqual(await display('https://example.test/index.html'), {});
});

test('display media is empty when no source is chosen or choosing one fails', async () => {
  for (const mediaSource of [
    async () => null,
    async () => {
      throw new Error('no screen');
    },
  ]) {
    const { display } = fixture({ mediaSource });
    assert.deepEqual(await display(RENDERER), {});
  }
});
