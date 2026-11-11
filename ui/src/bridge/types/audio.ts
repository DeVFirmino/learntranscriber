import type { Unsubscribe } from './subscription'

// Each side's loudness, from 0 (silence) to 1.
export interface AudioLevels {
  me: number
  they: number
}

export interface OutputDevice {
  uid: string
  name: string
  isDefault: boolean
  hasInput: boolean
}

// The shared incoming-audio capture held by leases in the main process.
export interface OutputLease {
  sessionId?: string
  route?: string
  fellBack?: boolean
  reason?: string
  alreadyActive?: boolean
  shared?: boolean
  cancelled?: boolean
  error?: string
}

export interface OutputState extends OutputLease {
  state: 'active' | 'stopped' | 'reconnecting'
  leases: number
  transient?: boolean
  unexpected?: boolean
  reason?: string
  deviceId?: string
  deviceName?: string
}

export interface OutputStatus extends OutputLease {
  active: boolean
  leases: number
  devices: OutputDevice[]
  defaultOutputUID: string | null
  driver: {
    required: boolean
    installed: boolean
    installable: boolean
    supported: boolean
    processTapSupported: boolean
    reason: string
    blocker: string
    loopbackDevices: { uid: string; name: string }[]
  }
}

export interface AudioSegment {
  sessionId: string
  speaker: string
  mime: string
  bytes: ArrayBuffer
  segmentId?: string
}

export interface LiveCaption {
  sessionId: string
  speaker: string
  text: string
  final: boolean
  error?: string
}

export interface SpeechAssets {
  assetManagementAvailable: boolean
  reservedLocales: string[]
  installedLocales: string[]
  maximumReservedLocales: number
  locales: string[]
}

export interface AudioApi {
  startLiveTranscription: (id: string) => Promise<boolean>
  pushLiveAudio: (input: { sessionId: string; speaker: string; samples: ArrayBuffer }) => Promise<boolean>
  stopLiveTranscription: () => Promise<boolean>
  updateLiveLanguage: (input: {
    sessionId: string
    language?: string
    prompt?: string
  }) => Promise<{ sessionId: string; language: string }>
  onLiveCaption: (listener: (caption: LiveCaption) => void) => Unsubscribe
  reportListening: (active: boolean, starting?: boolean, paused?: boolean) => Promise<boolean>
  // The workspace's live loudness of each side, forwarded to the floating bar's wave.
  reportAudioLevels: (levels: AudioLevels) => Promise<boolean>
  onAudioLevels: (listener: (levels: AudioLevels) => void) => Unsubscribe
  pauseListening: () => Promise<boolean>
  setLivePaused: (paused: boolean) => Promise<boolean>
  transcribe: (input: AudioSegment) => Promise<string>
  startSystemAudio: (id: string) => Promise<unknown>
  stopSystemAudio: () => Promise<unknown>
  systemAudioStatus: () => Promise<unknown>
  acquireSystemAudio: (lease: string, id: string) => Promise<OutputLease>
  releaseSystemAudio: (lease: string) => Promise<unknown>
  abandonSystemAudio: (lease: string) => Promise<unknown>
  switchSystemAudio: () => Promise<OutputLease & { restarted: boolean }>
  outputDevices: () => Promise<{ devices: OutputDevice[]; defaultOutputUID: string | null }>
  outputStatus: () => Promise<OutputStatus>
  onOutputState: (listener: (state: OutputState) => void) => Unsubscribe
  onSystemAudio: (listener: (segment: AudioSegment) => void) => Unsubscribe
  onSystemAudioError: (listener: (message: string) => void) => Unsubscribe
  speechAssets: () => Promise<SpeechAssets>
  manageSpeechLocale: (input: { operation: string; locale: string }) => Promise<{ assetManagementAvailable?: boolean }>
  cancelSpeechAssets: () => Promise<boolean>
  speechCapabilities: () => Promise<{ locale: string; supportsOnDeviceRecognition: boolean; authorization: string }>
}
