import type { AudioApi } from '../types/audio'
import type { MockContext } from './state'

// Preview output devices; the real list comes from Core Audio in the macOS app.
const PREVIEW_OUTPUTS = [
  { uid: 'preview-speakers', name: 'Built-in speakers (preview)', isDefault: true, hasInput: false },
  { uid: 'preview-loopback', name: 'Loopback 2ch (preview)', isDefault: false, hasInput: true },
]

export function audioApi(ctx: MockContext) {
  const { state, systemAudio, systemAudioErrors, settings, emit, addEntry } = ctx
  const api: AudioApi = {
    startLiveTranscription: async () => {
      throw new Error('Live captions require the native Mac app. Preview does not record.')
    },
    pushLiveAudio: async () => {
      throw new Error('Preview does not accept microphone audio.')
    },
    stopLiveTranscription: async () => true,
    updateLiveLanguage: async () => {
      throw new Error('Live captions require the native Mac app. Preview does not record.')
    },
    onLiveCaption: () => () => {},
    transcribe: async (input) => {
      if (state.activeSessionId !== input.sessionId) throw new Error('Start or resume this session before recording.')
      if (!['ME', 'THEY'].includes(input.speaker)) throw new Error('Invalid speaker.')
      if (!(input.bytes instanceof ArrayBuffer) || !input.bytes.byteLength || input.bytes.byteLength > 20000000)
        throw new Error('Audio segment must be between 1 byte and 20 MB.')
      const content = `Preview transcription (${input.speaker}). ${input.bytes.byteLength} bytes stayed in this browser. No provider was contacted.`
      addEntry(input.sessionId, 'transcript', content, input.speaker)
      emit()
      return content
    },
    startSystemAudio: async () => {
      throw new Error('Native system audio is only available in the macOS app.')
    },
    stopSystemAudio: async () => true,
    systemAudioStatus: async () => ({ running: false, preview: true }),
    acquireSystemAudio: async () => {
      throw new Error('Native system audio is only available in the macOS app.')
    },
    releaseSystemAudio: async () => ({ alreadyReleased: true }),
    abandonSystemAudio: async () => ({ alreadyReleased: true }),
    switchSystemAudio: async () => ({ restarted: false }),
    outputDevices: async () => ({ devices: PREVIEW_OUTPUTS, defaultOutputUID: PREVIEW_OUTPUTS[0].uid }),
    outputStatus: async () => ({
      active: false,
      leases: 0,
      devices: PREVIEW_OUTPUTS,
      defaultOutputUID: PREVIEW_OUTPUTS[0].uid,
      driver: {
        required: false,
        installed: false,
        installable: false,
        supported: true,
        processTapSupported: true,
        reason:
          'Incoming audio uses ScreenCaptureKit or a Core Audio process tap; neither needs a virtual audio driver.',
        blocker:
          'No owned, signed audio driver ships with this build, so driver installation and removal are not offered.',
        loopbackDevices: PREVIEW_OUTPUTS.filter((device) => device.hasInput).map(({ uid, name }) => ({ uid, name })),
      },
    }),
    onOutputState: () => () => {},
    onSystemAudio: systemAudio.subscribe,
    onSystemAudioError: systemAudioErrors.subscribe,
    speechAssets: async () => ({
      assetManagementAvailable: false,
      reservedLocales: [],
      installedLocales: [],
      maximumReservedLocales: 0,
      locales: [],
    }),
    manageSpeechLocale: async () => {
      throw new Error('Managed languages are unavailable in this browser preview.')
    },
    cancelSpeechAssets: async () => true,
    speechCapabilities: async () => ({
      locale: settings.appleSpeechLocale,
      supportsOnDeviceRecognition: false,
      authorization: 'not-determined',
    }),
    reportListening: async (active, starting = false, paused = false) => {
      if (
        active === state.listening.active &&
        starting === Boolean(state.listening.starting) &&
        paused === Boolean(state.listening.paused)
      )
        return true
      state.listening = { active, starting, paused, since: active ? state.listening.since || Date.now() : null }
      if (active) state.overlayExpanded = true
      emit()
      return true
    },
    // The preview records nothing, so the bar's wave stays still.
    reportAudioLevels: async () => true,
    onAudioLevels: () => () => {},
    setLivePaused: async () => true,
    pauseListening: async () => {
      state.listening.paused = !state.listening.paused
      emit()
      return true
    },
  }
  return api
}
