// The Electron lifecycle: one app instance composes the application and hands it the lifecycle events.
const { app } = require('electron');
const path = require('node:path');
const os = require('node:os');
const smoke = process.argv.includes('--smoke-test');
if (smoke) app.setPath('userData', path.join(os.tmpdir(), `learntranscriber-smoke-${process.pid}`));
// The smoke runs under its own name, so its safeStorage key is its own Keychain item and never the installed app's.
app.setName(smoke ? 'LearnTranscriber Smoke' : 'LearnTranscriber');
// The renderer's app:// scheme has to be declared before the app is ready.
require('./infrastructure/electron/app-protocol.cjs').registerAppScheme(require('electron').protocol);
const application = require('./composition.cjs').composeApplication({
  electron: require('electron'),
  smoke: smoke ? require('./smoke-hooks.cjs').smokeHooks() : null,
});

if (!smoke && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app
    .whenReady()
    .then(() => application.start())
    .catch((error) => {
      console.error('Application startup failed:', error.message);
      application.startupFailed();
      app.quit();
    });
  app.on('second-instance', () => application.showMain());
  app.on('activate', () => application.activate());
}
app.on('window-all-closed', () => {});
app.on('before-quit', (event) => application.beforeQuit(event));
app.on('will-quit', () => application.willQuit());
