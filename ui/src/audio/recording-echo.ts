import type { EchoCapture } from './echo-capture'
import type { EchoReduction } from './echo-reduction'
import type { EchoReference } from './echo-reference'
import { pcm16ToFloat32, float32ToPcm16 } from './pcm'

// The worklet's usual block, and the smaller one echo reduction needs: AEC3 cancels only what the incoming audio
// already covers, so the microphone is processed in 32 ms steps instead of 256 ms ones.
const BLOCK_SAMPLES = 4096
const ECHO_BLOCK_SAMPLES = 512

// Echo reduction for one recording. The microphone side cancels the echo of the incoming audio, which is the
// reference only while incoming audio is recorded. It follows the user's setting when the recording starts and while
// it runs; without the window's echo reduction the microphone is recorded as is.
export class RecordingEcho {
  private mic: EchoCapture | null = null
  private incoming: EchoReference | null = null
  private echo?: EchoReduction

  constructor(echo?: EchoReduction) {
    this.echo = echo
  }

  // The worklet block size the current setting needs.
  get blockSize() {
    return this.echo?.enabled ? ECHO_BLOCK_SAMPLES : BLOCK_SAMPLES
  }

  start(settings: { echoReductionEnabled?: boolean; systemAudio: boolean }) {
    const echo = this.echo
    if (!echo) return
    if (settings.echoReductionEnabled !== undefined) echo.setEnabled(settings.echoReductionEnabled)
    this.mic = echo.capture()
    this.follow(settings)
  }

  follow(settings: { systemAudio: boolean }) {
    const echo = this.echo
    if (!echo || !this.mic) return
    if (settings.systemAudio && !this.incoming) this.incoming = echo.reference()
    else if (!settings.systemAudio && this.incoming) {
      this.incoming.release()
      this.incoming = null
    }
  }

  // Whether the setting changed, so the worklets switch to the block size it needs.
  setEnabled(enabled: boolean) {
    const echo = this.echo
    if (!echo || echo.enabled === enabled) return false
    echo.setEnabled(enabled)
    return true
  }

  // The canceller is loaded before the microphone starts.
  prepare() {
    return this.mic?.prepare()
  }

  resetCapture() {
    this.mic?.resetCapture()
  }

  // The native helper's incoming audio is the echo reference too.
  analyzeIncoming(samples: Int16Array, rate: number) {
    this.incoming?.analyzePCM16(samples, rate)
  }

  // The microphone block comes out delayed and echo-cancelled; incoming blocks become the echo reference.
  block(speaker: string, samples: Int16Array, rate: number) {
    if (speaker === 'THEY') {
      this.incoming?.analyzePCM16(samples, rate)
      return samples
    }
    if (!this.mic || !this.echo?.enabled) return samples
    return float32ToPcm16(this.mic.processFloat32(pcm16ToFloat32(samples), rate))
  }

  stop() {
    this.mic?.resetCapture()
    this.mic?.release()
    this.incoming?.release()
    this.mic = null
    this.incoming = null
  }
}
