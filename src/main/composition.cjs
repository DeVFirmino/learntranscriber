const { composeControls } = require('./composition/controls.cjs');
const { registerControllers } = require('./composition/controllers.cjs');
const { composeCore } = require('./composition/core.cjs');
const { composeErrorLog } = require('./composition/error-log.cjs');
const { composeLifecycle } = require('./composition/lifecycle.cjs');
const { composeServices } = require('./composition/services.cjs');
const { startDesktop } = require('./composition/startup.cjs');
const { handleAppScheme } = require('./infrastructure/electron/app-protocol.cjs');

// The composition root: constructs every module with its real platform dependencies, registers the IPC
// controllers and owns startup and shutdown order. Importing it starts nothing; start() does.
function composeApplication({ electron, smoke = null, platform = process.platform }) {
  // What start() creates, filled in as it runs; wiring made before start reads it only when a callback runs.
  const started = {};
  let quitting = false;
  const markQuitting = () => {
    quitting = true;
  };
  const quit = () => {
    markQuitting();
    electron.app.quit();
  };
  const core = composeCore({ electron, smoke, started, platform, isQuitting: () => quitting });
  async function start() {
    // The smoke runs against a throwaway profile and must not write to the user's log folder.
    if (!smoke) composeErrorLog({ app: electron.app, console, now: () => new Date() });
    // index.cjs declared the app:// scheme before ready; now the renderer files are served through it.
    handleAppScheme({ protocol: electron.protocol, net: electron.net, root: core.rendererRoot });
    Object.assign(started, composeControls({ electron, platform, core, started, quit }));
    await composeServices({ electron, smoke, platform, core, started });
    registerControllers({ electron, core, started });
    startDesktop({ electron, platform, core, started });
    await smoke?.run({
      app: electron.app,
      repositories: started.repositories,
      privacy: started.privacy,
      localModels: started.localModels,
      nativeContext: core.nativeContext,
      systemAudio: core.systemAudio,
      liveTranscription: started.engines.whisper,
      dispatchShortcut: started.dispatchShortcut,
      chatgptAuth: started.chatgptAuth,
      selectionWatcher: started.selectionWatcher,
      saveSettings: started.saveSettings,
      providers: core.providers,
      changed: core.changed,
      windows: core.windows,
      notchState: core.notchState,
      active: core.active,
      quit,
    });
  }
  return { start, ...composeLifecycle({ electron, core, started, markQuitting }) };
}
module.exports = { composeApplication };
