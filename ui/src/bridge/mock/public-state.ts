import type { Assistant } from '../types/assistants'
import type { LocalState } from '../types/local-models'
import type { SessionDetail } from '../types/sessions'
import type { Settings } from '../types/settings'
import type { PublicState } from '../types/state'
import { previewBuiltIns } from './library-fixtures'
import { CATALOG } from './model-catalog'
import { summaryOf } from './session-text'
import { shortcutDefinitions } from './shortcut-definitions'
import type { MockState } from './state'

// The state the main process would publish, built from copies so a reader cannot change the preview's own data.
export function buildPublicState({
  state,
  settings,
  credentials,
  assistants,
  sessions,
  local,
  accounts,
}: {
  state: MockState
  settings: Settings
  credentials: Record<string, boolean>
  assistants: Assistant[]
  sessions: Map<string, SessionDetail>
  local: LocalState
  accounts: { id: string; label: string; authenticated: boolean }[]
}): PublicState {
  return {
    settings: { ...settings },
    credentials: { ...credentials },
    customHeaderNames: state.customHeaders.map((item) => item.key),
    assistants: assistants.map((assistant) => ({ ...assistant })),
    builtInAssistants: previewBuiltIns(),
    sessions: [...sessions.values()].map(summaryOf).sort((a, b) => b.started_at.localeCompare(a.started_at)),
    activeSessionId: state.activeSessionId,
    localModels: structuredClone(local),
    runtimeInstalls: state.runtimeInstalls.map((item) => ({ ...item })),
    modelCatalog: CATALOG.map((item) => ({ ...item })),
    chatgpt: { accounts: accounts.map((account) => ({ ...account })), activeId: state.activeAccount, pending: false },
    notch: {
      expanded: state.notchExpanded,
      visible: settings.notchEnabled,
      pendingAutomatic: false,
      lastDisplayedAt: null,
      bounds: { ...state.notchBounds },
      pinned: settings.notchPinned,
    },
    overlay: {
      expanded: state.overlayExpanded,
      listening: { ...state.listening },
      // The same rule as the main process: rows only while the panel is collapsed.
      barRows: {
        prompt: Boolean(state.activeSessionId) && !state.overlayExpanded,
        preview: (state.listening.active || Boolean(state.listening.starting)) && !state.overlayExpanded,
        guide:
          settings.onboardingGuide &&
          !state.overlayExpanded &&
          !(state.listening.active || Boolean(state.listening.starting)),
      },
    },
    shortcutDefinitions: shortcutDefinitions(settings.shortcuts),
    privacy: {
      concealed: state.concealed,
      captureProtectionRequested: settings.stealthMode || settings.captureProtection,
      stealthMode: settings.stealthMode,
      dockHidden: settings.stealthMode || settings.hideDock,
      menuBarIconVisible: settings.showMenuBarIcon,
      menuBarRecoveryFallback: false,
      platform: 'darwin',
      shortcuts: {
        hide: 'CommandOrControl+B',
        overlay: 'CommandOrControl+M',
        clickThrough: 'CommandOrControl+Shift+I',
      },
      shortcutStatus: { hide: true, overlay: true, clickThrough: true, selection: true },
    },
    permissions: { microphone: 'not-determined', screen: 'not-determined' },
  }
}
