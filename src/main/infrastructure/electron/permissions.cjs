// Microphone and screen media are granted only to the app's own windows, and display capture only to the
// trusted renderer page, with system audio as loopback.
function configureMediaPermissions({ session, privacy, BrowserWindow, rendererUrl, mediaSource }) {
  const owned = (contents) => privacy.windows.has(BrowserWindow.fromWebContents(contents));
  const allowed = (permission) => ['media', 'display-capture'].includes(permission);
  session.setPermissionRequestHandler((contents, permission, callback) =>
    callback(owned(contents) && allowed(permission)),
  );
  session.setPermissionCheckHandler(
    (contents, permission) => Boolean(contents && owned(contents)) && allowed(permission),
  );
  session.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      if (request.frame.url.split('#')[0].split('?')[0] !== rendererUrl) {
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
