// The full state every window receives. It carries key status and header names, never credential values.
function createWorkspaceState({ library, runtime, windows, desktop }) {
  return {
    snapshot() {
      const settings = library.settings();
      return {
        settings,
        credentials: library.credentials(),
        customHeaderNames: library.headerNames(),
        assistants: library.assistants(),
        builtInAssistants: library.builtInAssistants(),
        sessions: library.sessions(),
        activeSessionId: runtime.activeId(),
        localModels: runtime.localModels(),
        runtimeInstalls: runtime.runtimeInstalls(),
        modelCatalog: runtime.modelCatalog,
        chatgpt: runtime.chatgpt(),
        notch: windows.notch(),
        overlay: windows.overlay(),
        shortcutDefinitions: desktop.shortcutDefinitions(),
        privacy: desktop.privacy(),
        permissions: desktop.permissions(),
      };
    },
  };
}
module.exports = { createWorkspaceState };
