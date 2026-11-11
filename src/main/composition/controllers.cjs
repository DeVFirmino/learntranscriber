const { windowCallers } = require('../infrastructure/electron/callers.cjs');
const { configureMediaPermissions } = require('../infrastructure/electron/permissions.cjs');
const { registerCredentials } = require('../interface/ipc/credentials.cjs');
const { registerSettings } = require('../interface/ipc/settings.cjs');
const { composeAssistants } = require('./assistants.cjs');
const { composeAudio } = require('./audio.cjs');
const { composeDesktop } = require('./desktop.cjs');
const { composeMemory } = require('./memory.cjs');
const { composeSessions } = require('./sessions.cjs');
const { sessionNoteFiles } = require('../infrastructure/files/session-note-files.cjs');
const { filePicker } = require('../infrastructure/electron/file-picker.cjs');
const { composeWorkspace } = require('./workspace.cjs');
const { createAppFolders } = require('../infrastructure/electron/app-folders.cjs');

// Registers every feature's IPC controllers once the services exist, then lets the app's windows capture media.
function registerControllers({ electron: { app, BrowserWindow, clipboard, dialog, shell, session }, core, started }) {
  const { handle, saveSettings, repositories, engines } = started;
  const { active, broadcast, changed, providers, requests, modelRoute, windows, notchWindow } = core;
  const callers = windowCallers({ BrowserWindow, privacy: () => started.privacy, windows });
  composeWorkspace({
    handle,
    repositories,
    active,
    state: started.workspaceState.snapshot,
    shortcuts: started.shortcuts,
    compactor: () => started.compactor,
    generate: core.generate,
    callers,
    quit: core.quitFlush,
    folders: createAppFolders({ app, shell }),
    windows,
    privacy: () => started.privacy,
    notch: { state: core.notchState, window: notchWindow },
    saveSettings,
    fanOut: core.fanOut,
    changed,
  });
  registerSettings(handle, started.settingsUpdate);
  registerCredentials(handle, core.credentials);
  composeAssistants({
    handle,
    repositories,
    providers,
    route: modelRoute,
    requests,
    clipboard,
    saveSettings,
    callers,
    changed,
  });
  started.outputLeases = composeAudio({
    handle,
    active,
    settings: core.readSettings,
    entries: repositories.entries,
    systemAudio: core.systemAudio,
    engines,
    jobs: core.transcriptionJobs,
    nativeSpeech: core.nativeSpeech,
    transcribe: started.transcribeBytes,
    broadcast,
    changed,
  });
  composeSessions({
    handle,
    repositories,
    active,
    metadata: () => started.sessionMetadata(),
    requests,
    route: modelRoute,
    providers,
    outputLeases: started.outputLeases,
    appleSpeech: engines.apple,
    transcriptionJobs: core.transcriptionJobs,
    screenInsights: core.screenInsights,
    realtimePrompts: core.realtimePrompts,
    isLiveNotch: (event, sessionId) => notchWindow.owns(event) && active.id() === sessionId,
    noteFiles: sessionNoteFiles({
      documents: () => app.getPath('documents'),
      openPath: (target) => shell.openPath(target),
    }),
    picker: filePicker({ dialog, BrowserWindow }),
    titles: started.sessionTitles,
    saveSettings,
    changed,
  });
  composeMemory({ handle, repositories, requests, transcribe: started.transcribeBytes });

  composeDesktop({
    handle,
    broadcast,
    sessions: repositories.sessions,
    active,
    capture: core.screenCapture,
    screenshot: () => core.captureDisplay(),
    nativeContext: core.nativeContext,
    desktop: core.desktop,
    electron: { dialog, BrowserWindow },
  });
  configureMediaPermissions({
    session: session.defaultSession,
    privacy: started.privacy,
    BrowserWindow,
    rendererUrl: core.rendererUrl,
    mediaSource: () => core.screenCapture.mediaSource(),
  });
}
module.exports = { registerControllers };
