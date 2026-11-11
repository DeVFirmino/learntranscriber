// The WebRTC AEC3 module's shape (@ennuicastr/webrtcaec3.js 0.3.0) and this build's echo-reduction defaults.
export interface Aec3ProcessOptions {
  sampleRateIn?: number
  sampleRateOut?: number
}

export interface Aec3Instance {
  analyze(data: Float32Array[], options?: { sampleRateIn?: number }): void
  processSize(data: Float32Array[], options?: Aec3ProcessOptions): number
  process(out: Float32Array[], data: Float32Array[], options?: Aec3ProcessOptions): void
  setAudioBufferDelay?(delayMs: number): void
  free(): void
}

export interface Aec3Module {
  AEC3: new (sampleRate: number, renderChannels: number, captureChannels: number) => Aec3Instance
}

// Fixed echo-reduction defaults; this build has no remote configuration to read them from.
export const AEC_SAMPLE_RATE = 48000
export const REFERENCE_TIMEOUT_MS = 500
export const AUDIO_BUFFER_DELAY_MS = 0
export const CAPTURE_DELAY_MS = 60
