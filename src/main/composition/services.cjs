const path = require('node:path');
const { PrivacyController } = require('../infrastructure/electron/privacy.cjs');
const { filePicker } = require('../infrastructure/electron/file-picker.cjs');
const { openDatabase } = require('../infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../infrastructure/sqlite/repositories.cjs');
const { composeChatGPT } = require('./chatgpt.cjs');
const { composeCompaction } = require('./compaction.cjs');
const { createContextWatchers } = require('./context-watchers.cjs');
const { composeGeneration } = require('./generation.cjs');
const { createLiveEngines } = require('./live-engines.cjs');
const { composeLocalModels } = require('./local-models.cjs');
const { composeWorkspaceState } = require('./workspace-state.cjs');
const { composeSessionTitles } = require('./session-titles.cjs');
const { composeUpdates } = require('./updates.cjs');

// The services start() creates over the opened workspace, in the order they need each other. Each is put in
// `started` as soon as it exists, so a callback that runs meanwhile already sees it.
// How long after start the saved ChatGPT sign-in is read, so the floating assistant appears first.
const CHATGPT_RESTORE_DELAY_MS = 1500;

async function composeServices({ electron, smoke, platform, core, started }) {
  const { app, dialog, BrowserWindow, shell, clipboard } = electron;
  const { active, broadcast, changed, providers, requests, notchState, notchWindow, windows } = core;
  const { handle } = started;
  const userData = (name) => path.join(app.getPath('userData'), name);
  const report = (message) => broadcast('integration:error', message);
  const openExternal = (url) => shell.openExternal(url);
  const repositories = createRepositories(openDatabase(userData('workspace.sqlite')), { platform });
  started.repositories = repositories;
  Object.assign(
    started,
    composeCompaction({
      repositories,
      active,
      listening: () => windows.listening(),
      route: core.modelRoute,
      providers,
      changed,
      report,
    }),
  );
  ({ models: started.localModels, installer: started.runtimeInstaller } = await composeLocalModels({
    handle,
    directory: userData('local-models'),
    settings: core.readSettings,
    providers,
    picker: filePicker({ dialog, BrowserWindow }),
    broadcast,
  }));
  started.engines = createLiveEngines({
    repositories,
    localModels: started.localModels,
    vault: core.vault,
    nativeSpeech: core.nativeSpeech,
    transcribe: started.transcribeBytes,
    speech: core.liveSpeech,
    fanOut: core.fanOut,
    changed,
  });
  ({ auth: started.chatgptAuth, accounts: started.chatgptAccounts } = composeChatGPT({
    handle,
    repositories,
    vault: core.vault,
    requests,
    openExternal,
    changed,
  }));
  // Reading the saved ChatGPT sign-in is the first macOS Keychain access, which blocks the main process for seconds
  // in the packaged app. It waits until the windows are up, then publishes the restored accounts; a request that needs
  // a token before then reads it itself. The smoke harness keeps the old order so its fixtures stay deterministic.
  if (smoke) await started.chatgptAccounts.restore();
  else setTimeout(() => void started.chatgptAccounts.restore().then(changed), CHATGPT_RESTORE_DELAY_MS);
  ({ selection: started.selectionWatcher, copy: started.copyWatcher } = createContextWatchers({
    nativeContext: core.nativeContext,
    clipboard,
    insights: core.screenInsights,
    settings: repositories.settings,
    changed,
    report,
  }));
  started.generation = composeGeneration({
    repositories,
    active,
    requests,
    localModels: started.localModels,
    notch: { state: notchState, window: notchWindow, expand: () => windows.setNotchExpanded(true) },
    compactor: started.compactor,
    providers,
    realtimePrompts: core.realtimePrompts,
    fanOut: core.fanOut,
    changed,
  });
  started.sessionTitles = composeSessionTitles({
    sessions: repositories.sessions,
    sessionSearch: repositories.sessionSearch,
    settings: repositories.settings,
    activeId: active.id,
    providers,
    route: core.modelRoute,
    requests,
    changed,
    schedule: !smoke,
  });
  started.privacy = new PrivacyController(app, repositories.settings.read(), platform);
  started.workspaceState = composeWorkspaceState({
    repositories,
    credentials: core.credentials,
    active,
    localModels: started.localModels,
    runtimeInstaller: started.runtimeInstaller,
    chatgpt: started.chatgptAccounts,
    notch: { state: notchState, window: notchWindow },
    windows,
    shortcuts: { status: core.shortcutStatus, accelerator: started.shortcutAccelerator },
    platform,
    privacy: started.privacy,
    tray: started.tray,
    desktop: core.desktop,
  });
  started.updates = composeUpdates({
    handle,
    settings: repositories.settings,
    version: core.desktop.version(),
    openExternal,
    broadcast,
    schedule: !smoke,
  });
}
module.exports = { composeServices };
