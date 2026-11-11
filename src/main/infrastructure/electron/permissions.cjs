const { pageOf } = require('../../domain/shared/page-url.cjs');

// Media goes only to the bundled renderer page in the top frame of a window the app owns: the microphone through
// `media`, never the camera, and the screen with its audio through `display-capture`, which carries system audio as
// loopback. Electron describes the frame in `details`; a request or check without that description is refused.
function configureMediaPermissions({ session, privacy, BrowserWindow, rendererUrl, mediaSource }) {
  const owned = (contents) => Boolean(contents) && privacy.windows.has(BrowserWindow.fromWebContents(contents));
  const trustedFrame = (contents, details) =>
    owned(contents) &&
    details?.isMainFrame === true &&
    typeof details.requestingUrl === 'string' &&
    pageOf(details.requestingUrl) === rendererUrl;
  const audioOnly = (types) => Array.isArray(types) && types.length > 0 && types.every((type) => type === 'audio');
  session.setPermissionRequestHandler((contents, permission, callback, details) => {
    if (!trustedFrame(contents, details)) callback(false);
    else if (permission === 'media') callback(audioOnly(details.mediaTypes));
    else callback(permission === 'display-capture');
  });
  session.setPermissionCheckHandler((contents, permission, _origin, details) => {
    if (!trustedFrame(contents, details)) return false;
    if (permission === 'media') return details.mediaType === 'audio';
    return permission === 'display-capture';
  });
  session.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      if (pageOf(request.frame.url) !== rendererUrl) {
        callback({});
        return;
      }
      const source = await mediaSource();
      if (!source) {
        callback({});
        return;
      }
      callback({ video: source, audio: 'loopback' });
    } catch {
      callback({});
    }
  });
}
module.exports = { configureMediaPermissions };
