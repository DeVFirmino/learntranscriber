const path = require('node:path');
const { RENDERER_URL } = require('../infrastructure/electron/app-protocol.cjs');
const { createRealtimePrompts } = require('../application/assistants/realtime-prompts.cjs');
const { createTranscriptionJobs } = require('../application/audio/transcription-jobs.cjs');
const { createActiveSession } = require('../application/runtime/active-session.cjs');
const { createLiveSpeech } = require('../application/runtime/live-speech.cjs');
const { createNotchState } = require('../application/runtime/notch-state.cjs');
const { displayCapture } = require('../infrastructure/electron/capture.cjs');
const { electronDesktop } = require('../infrastructure/electron/desktop.cjs');
const { composeNative } = require('./native.cjs');
const { composeProviders } = require('./providers.cjs');
const { composePublication } = require('./publication.cjs');
const { composeRuntime } = require('./runtime.cjs');
const { composeScreenInsights } = require('./screen-insights.cjs');
const { composeWindows } = require('./windows.cjs');

const ROOT = path.resolve(__dirname, '../../..');

// What exists before start: the live session and Notch state, the runtime, the windows, the native helpers, provider
// access, screen capture and insights, and what a change sets off. What start() creates is read from
// `started` only when a callback runs.
function composeCore({ electron, smoke, started, platform, isQuitting }) {
  const { app, BrowserWindow, screen, safeStorage, clipboard, nativeImage, shell, systemPreferences, desktopCapturer } =
    electron;
  const active = createActiveSession();
  const notchState = createNotchState({ now: Date.now });
  const transcriptionJobs = createTranscriptionJobs();
  const liveSpeech = createLiveSpeech();
  const readSettings = () => started.repositories.settings.read();
  const generate = (event, input) => started.generation.run(input, { sender: event.sender });
  let shortcutsSuspended = false;
  const { requests, ownerCleanup, modelRoute, quitFlush, shutdown } = composeRuntime({
    live: () => started.engines,
    localModels: () => started.localModels,
    systemAudio: () => systemAudio,
    transcriptionJobs,
    mainWindow: () => windows.main(),
  });
  // The built renderer, served to the windows through the app:// protocol.
  const rendererRoot = path.join(ROOT, 'ui/dist');
  const rendererUrl = RENDERER_URL;
  const { windows, notchWindow, fanOut, broadcast } = composeWindows({
    electron: { BrowserWindow, screen },
    ownerCleanup,
    privacy: () => started.privacy,
    settings: readSettings,
    active,
    notchState,
    renderer: { url: rendererUrl },
    preload: path.join(ROOT, 'src/main/preload.cjs'),
    platform,
    isQuitting,
    changed: () => changed(),
    onSettingsOpen: (open) => {
      shortcutsSuspended = open;
      started.visibility?.cancel();
      started.shortcutRegistry?.setSuspended(open);
    },
  });
  const {
    speech: nativeSpeech,
    context: nativeContext,
    systemAudio,
  } = composeNative({
    paths: { packaged: app.isPackaged, resourcesPath: process.resourcesPath, root: ROOT },
    db: () => started.repositories.db,
    active,
    appleSpeech: () => started.engines?.apple,
    broadcast,
    outputLeases: () => started.outputLeases,
  });
  const { vault, credentials, providers } = composeProviders({
    credentials: () => started.repositories.credentials,
    safeStorage,
    chatgptToken: () => started.chatgptAuth.token(),
    timers: { setTimeout, clearTimeout },
    changed: () => changed(),
  });
  const screenCapture = displayCapture({ desktopCapturer, screen, settings: readSettings });
  const thumbnail = () => screenCapture.thumbnail();
  const captureDisplay = smoke?.screenshot(thumbnail) ?? thumbnail;
  const screenInsights = composeScreenInsights({
    settings: readSettings,
    active,
    privacy: () => started.privacy,
    requests,
    windows,
    liveSpeech,
    screenshot: () => captureDisplay(),
    broadcast,
    generate,
  });
  const publication = composePublication({
    active,
    privacy: () => started.privacy,
    settings: readSettings,
    notchState,
    windows,
    shortcuts: { registry: () => started.shortcutRegistry, visibility: () => started.visibility },
    watchers: { copy: () => started.copyWatcher, selection: () => started.selectionWatcher },
    screenInsights,
    tray: () => started.tray,
    workspaceState: () => started.workspaceState,
    broadcast,
  });
  function changed() {
    publication.changed();
    started.transcriptCompactor?.update();
  }
  return {
    root: ROOT,
    active,
    notchState,
    transcriptionJobs,
    liveSpeech,
    shortcutStatus: {},
    shortcutsSuspended: () => shortcutsSuspended,
    readSettings,
    generate,
    requests,
    modelRoute,
    quitFlush,
    shutdown,
    rendererUrl,
    rendererRoot,
    windows,
    notchWindow,
    fanOut,
    broadcast,
    nativeSpeech,
    nativeContext,
    systemAudio,
    vault,
    credentials,
    providers,
    realtimePrompts: createRealtimePrompts({ providers, now: Date.now }),
    desktop: electronDesktop({ clipboard, nativeImage, shell, systemPreferences, app }),
    screenCapture,
    captureDisplay,
    screenInsights,
    changed,
  };
}
module.exports = { composeCore };
