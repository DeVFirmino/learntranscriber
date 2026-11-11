const { createWorkspaceState } = require('../application/runtime/workspace-state.cjs');
const { notchStatus } = require('../application/notch/status.cjs');
const { shortcutDefinitions } = require('../application/settings/shortcut-definitions.cjs');
const { privacyStatus } = require('../application/settings/privacy-status.cjs');
const { MODEL_CATALOG } = require('../domain/providers/model-catalog.cjs');
const { BUILT_IN_ASSISTANTS } = require('../domain/assistants/built-in-catalog.cjs');

// Builds the public state every window receives from the library, the runtimes, the windows and the desktop.
function composeWorkspaceState({
  repositories,
  credentials,
  active,
  localModels,
  runtimeInstaller,
  chatgpt,
  notch,
  windows,
  shortcuts,
  platform,
  privacy,
  tray,
  desktop,
}) {
  const { settings } = repositories;
  return createWorkspaceState({
    library: {
      settings: () => settings.read(),
      credentials: () => repositories.credentials.status(),
      headerNames: () => credentials.headerNames(),
      assistants: () => repositories.assistants.all(),
      builtInAssistants: () => BUILT_IN_ASSISTANTS.map(({ id, name, category }) => ({ id, name, category })),
      sessions: () => repositories.sessionSearch.list(),
    },
    runtime: {
      activeId: active.id,
      localModels: () => localModels.state(),
      runtimeInstalls: () => runtimeInstaller.state(),
      modelCatalog: MODEL_CATALOG,
      chatgpt: () => chatgpt.status(),
    },
    windows: {
      notch: () =>
        notchStatus({
          state: notch.state,
          activeId: active.id(),
          window: notch.window,
          pinned: settings.read().notchPinned,
        }),
      overlay: () => ({
        expanded: windows.overlayExpanded(),
        listening: windows.listening(),
        barRows: windows.barRows(),
      }),
    },
    desktop: {
      shortcutDefinitions: () => shortcutDefinitions(settings.read().shortcuts, shortcuts.status, platform),
      privacy: () =>
        privacyStatus({
          privacy,
          settings: settings.read(),
          shortcutStatus: shortcuts.status,
          accelerator: shortcuts.accelerator,
          menuBarIconVisible: tray.visible(),
        }),
      permissions: () => desktop.permissions(),
    },
  });
}
module.exports = { composeWorkspaceState };
