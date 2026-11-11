// Saved values always win because only explicitly saved keys are stored.
const DEFAULTS = Object.freeze({
  onboardingDismissed: false,
  onboardingStarted: false,
  onboardingDemoSeen: false,
  onboardingCompleted: false,
  // On after an onboarding that ends in a real first session: the floating bar and panel coach that session.
  onboardingGuide: false,
  onboardingAudioSource: '',
  // Set once the user picks which built-in assistants to keep, the onboarding's assistant step.
  assistantsChosen: false,
  // Set after the one pass that names saved sessions still carrying the default title.
  sessionTitlesBackfilled: false,
  // Auto-compaction is on unless turned off; its threshold falls back to 50,000 estimated tokens.
  autoCompact: true,
  compactThreshold: 50000,
  localContextSize: 4096,
  localAutoStart: true,
  localWhisperGpu: true,
  localGpuLayers: 0,
  localBatchSize: 256,
  localUbatchSize: 64,
  localParallel: 1,
  localWarmup: false,
  localAutoTune: true,
  sessionTimer: false,
  // Where a stopped session's summary and handoff note is saved; empty means LearnTranscriber/Sessions in Documents.
  sessionNotesFolder: '',
  autoScroll: true,
  // Live insights and follow-ups appear in the Notch while a session listens.
  notchEnabled: true,
  notchMinimumVisibleSeconds: 15,
  notchOpacity: 1,
  notchFollowUps: true,
  surfaceTheme: 'dark',
  uiLanguage: '',
  workspaceZoom: 100,
  notchPinned: true,
  notchX: 0,
  notchY: 0,
  notchWidth: 400,
  notchHeight: 260,
  quickScreenshot: true,
  // Copying a selection with Command-C analyzes it.
  copyToPrompt: true,
  kvCacheMode: 'off',
  // Live captions and insights are on by default; OpenAI live transcription still needs
  // OpenAI chosen as the transcription source and its key.
  liveTranscription: true,
  shortcuts: '{}',
  translationProvider: '',
  translationModel: '',
  provider: 'openai',
  model: '',
  customBaseUrl: '',
  transcriptionBaseUrl: 'https://api.openai.com/v1',
  transcriptionModel: 'whisper-1',
  transcriptionPrompt: '',
  // Fresh profiles transcribe with OpenAI: no local engine and Apple native transcription off.
  transcriptionProvider: 'openai',
  appleSpeechLocale: 'en-US',
  language: '',
  // Empty turns incoming transcript translation off; that is the default.
  translationLanguage: '',
  microphoneId: 'default',
  // No incoming source is selected by default on macOS; Windows selects its default native output (defaultsFor).
  systemAudio: false,
  // native: ScreenCaptureKit; process-tap: Core Audio process tap of the default output (macOS 14.2+, falls back to
  // native); electron: window display capture; input-device: a loopback input chosen in systemAudioInputDevice.
  systemAudioSource: 'native',
  systemAudioInputDevice: '',
  // AEC3 echo reduction of the microphone against the incoming audio, off unless the
  // user turns it on (it suits speakers, not headphones, and adds about 60 ms to the microphone).
  echoReductionEnabled: false,
  displayId: '',
  stealthMode: false,
  showMenuBarIcon: false,
  captureProtection: true,
  hideDock: false,
  overlayOpacity: 0.95,
  unifiedModalFontScale: 1,
  overlayClickThrough: false,
  overlayOnTop: true,
  // Opens as the floating assistant bar; the workspace opens from Home or the Dock.
  launchFloating: true,
  autoInsights: true,
  // When live insights are requested: only_questions, moderate, proactive, full_power or meeting_notes.
  insightMode: 'proactive',
  assistantId: 'general',
  autoSelection: false,
  autoScreenInsights: false,
  // User-global prompts for assistants that leave the field empty.
  // Empty falls through to the packaged default.
  globalFollowUpPrompt: '',
  globalEmailPrompt: '',
  // The update notice: when the GitHub release check last actually ran, the release it last found (JSON, empty if
  // none), a snooze the Later action sets for at least 24 hours, and a tag Skip this version never shows again.
  updatesLastCheckAt: '',
  updatesLastRelease: '',
  updatesSnoozedUntil: '',
  updatesSkippedTag: '',
});

// The analysis model a provider starts with until one is saved. Other providers have no fixed model and keep
// asking for one.
const DEFAULT_MODELS = Object.freeze({ openai: 'gpt-4o-mini', gemini: 'gemini-3.5-flash' });

// The fresh-profile defaults on one platform.
function defaultsFor(platform) {
  return platform === 'win32' ? Object.freeze({ ...DEFAULTS, systemAudio: true }) : DEFAULTS;
}

module.exports = { DEFAULTS, DEFAULT_MODELS, defaultsFor };
