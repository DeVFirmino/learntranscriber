const path = require('node:path');
const { createAudioTranscriber } = require('../application/audio/transcribe-audio.cjs');
const { whisperInference } = require('../infrastructure/local/whisper-inference.cjs');
const { createIpcRegistrar } = require('../interface/ipc/register.cjs');
const { senderTrust } = require('../interface/ipc/trusted-sender.cjs');
const { composeDesktopControls } = require('./desktop-controls.cjs');
const { composeSettings } = require('./settings.cjs');

// What start() builds first: the IPC registrar, which trusts only the app's windows and refuses new work while
// quitting, the global shortcut actions and the menu bar icon, saving settings, and transcribing recorded audio.
function composeControls({
  electron: { ipcMain, BrowserWindow, Tray, Menu, nativeImage },
  platform,
  core,
  started,
  quit,
}) {
  const handle = createIpcRegistrar({
    ipcMain,
    trusted: senderTrust({
      BrowserWindow,
      registered: (window) => started.privacy.windows.has(window),
      rendererUrl: core.rendererUrl,
    }),
    accepts: (channel) => core.shutdown.accepts(channel),
  });
  const { visibility, shortcuts, tray } = composeDesktopControls({
    electron: { Tray, Menu, nativeImage },
    iconPath: path.join(core.root, 'assets/trayTemplate.png'),
    privacy: () => started.privacy,
    windows: core.windows,
    settings: core.readSettings,
    saveSettings: (patch) => saveSettings(patch),
    active: core.active,
    nativeContext: core.nativeContext,
    shortcutStatus: core.shortcutStatus,
    suspended: core.shortcutsSuspended,
    platform,
    broadcast: core.broadcast,
    changed: core.changed,
    quit,
  });
  const { update: settingsUpdate, metadata: sessionMetadata } = composeSettings({
    repositories: () => started.repositories,
    active: core.active,
    localModels: () => started.localModels,
    effects: {
      privacy: () => started.privacy,
      shortcuts: () => started.shortcutRegistry,
      screenInsights: core.screenInsights,
      appleSpeech: () => started.engines?.apple,
    },
    changed: core.changed,
    publicState: () => started.workspaceState.snapshot(),
  });
  const saveSettings = (patch) => settingsUpdate.save(patch);
  const audioTranscriber = createAudioTranscriber({
    acquireWhisper: () => started.localModels.acquire('whisper'),
    whisper: whisperInference,
    appleSpeech: core.nativeSpeech,
    providers: core.providers,
  });
  return {
    handle,
    visibility,
    shortcuts,
    tray,
    settingsUpdate,
    sessionMetadata,
    saveSettings,
    dispatchShortcut: (action) => shortcuts.dispatch(action),
    shortcutAccelerator: (id) => shortcuts.accelerator(id),
    transcribeBytes: (input, settings, signal) => audioTranscriber.transcribe(input, settings, signal),
  };
}
module.exports = { composeControls };
