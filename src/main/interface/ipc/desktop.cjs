function registerDesktop(handle, { context, desktop, capture, captureImage, exports }) {
  handle('sessions:export', (event, id) => exports.export(event.sender, id));
  handle('context:status', () => context.status());
  handle('context:permission', () => desktop.accessibilityPermission());
  handle('context:selection', () => context.selection());
  handle('context:ocr', () => context.ocr());
  handle('clipboard:read', () => desktop.readText());
  handle('clipboard:write-response', (_event, value) => desktop.writeResponse(value));
  handle('response:open-link', (_event, url) => desktop.openLink(url));
  handle('clipboard:image', () => desktop.readImage());
  handle('screens:list', () => capture.screens());
  handle('screen:capture', () => captureImage());
  handle('help:sharing', () => desktop.openSharingHelp());
  handle('permissions:microphone', () => desktop.requestMicrophone());
  handle('app:version', () => desktop.version());
  handle('app:relaunch', () => desktop.relaunch());
  handle('permissions:open', (_event, name) => desktop.openPrivacyPane(name));
}
module.exports = { registerDesktop };
