import type { PublicState } from './state'

export interface Settings {
  onboardingDismissed: boolean
  onboardingStarted: boolean
  onboardingDemoSeen: boolean
  onboardingCompleted: boolean
  onboardingGuide: boolean
  onboardingAudioSource: '' | 'microphone' | 'computer'
  assistantsChosen: boolean
  sessionTitlesBackfilled: boolean
  autoCompact: boolean
  compactThreshold: number
  localContextSize: number
  localAutoStart: boolean
  localWhisperGpu: boolean
  sessionTimer: boolean
  sessionNotesFolder: string
  autoScroll: boolean
  notchEnabled: boolean
  notchMinimumVisibleSeconds: number
  notchOpacity: number
  notchFollowUps: boolean
  surfaceTheme: 'dark' | 'light'
  uiLanguage: '' | 'en' | 'es' | 'pt-BR'
  workspaceZoom: number
  notchPinned: boolean
  notchX: number
  notchY: number
  notchWidth: number
  notchHeight: number
  quickScreenshot: boolean
  copyToPrompt: boolean
  kvCacheMode: string
  liveTranscription: boolean
  shortcuts: string
  translationProvider: string
  translationModel: string
  provider: string
  model: string
  customBaseUrl: string
  transcriptionBaseUrl: string
  transcriptionModel: string
  transcriptionPrompt: string
  transcriptionProvider: string
  appleSpeechLocale: string
  language: string
  translationLanguage: string
  microphoneId: string
  systemAudio: boolean
  systemAudioSource: string
  systemAudioInputDevice: string
  echoReductionEnabled: boolean
  displayId: string
  stealthMode: boolean
  showMenuBarIcon: boolean
  captureProtection: boolean
  hideDock: boolean
  overlayOpacity: number
  unifiedModalFontScale: number
  overlayClickThrough: boolean
  overlayOnTop: boolean
  launchFloating: boolean
  autoInsights: boolean
  insightMode: string
  assistantId: string
  autoSelection: boolean
  autoScreenInsights: boolean
  globalFollowUpPrompt: string
  globalEmailPrompt: string
}

export interface ShortcutDefinition {
  id: string
  label: string
  accelerator: string
  enabled: boolean
  registered: boolean
  // The action whose saved shortcut claimed this default; the default then stays unregistered.
  blockedBy?: string
  // The known action this shortcut implements, when it has one, and the defaults it resets to.
  reference?: string | null
  defaultAccelerator?: string
  defaultEnabled?: boolean
}

export interface PrivacyState {
  concealed: boolean
  stealthMode: boolean
  dockHidden: boolean
  menuBarIconVisible: boolean
  menuBarRecoveryFallback: boolean
  captureProtectionRequested: boolean
  platform: string
  shortcuts: { hide: string; overlay: string; clickThrough: string }
  shortcutStatus: Record<string, boolean>
}

export interface SettingsApi {
  settings: (patch: Partial<Settings>) => Promise<PublicState>
  saveKey: (input: { provider: string; key: string }) => Promise<Record<string, boolean>>
  saveCustomHeaders: (headers: { key: string; value: string | null }[]) => Promise<string[]>
  models: (provider?: string) => Promise<string[]>
}
