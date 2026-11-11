import { CAPTURE_DELAY_MS } from './aec3'

// The microphone held back by the capture delay, so the matching reference has already been analysed when a block
// is cancelled. The block align() returns is reused by the next call.
export class MicDelay {
  private line: Float32Array | null = null
  private scratch: Float32Array | null = null
  private index = 0
  private rate = 0

  get holding() {
    return this.line !== null
  }

  reset() {
    this.line = null
    this.scratch = null
    this.index = 0
    this.rate = 0
  }

  // The audio still held back, oldest first; taking it empties the delay.
  take() {
    if (!this.line) return null
    const held = new Float32Array(this.line.length)
    held.set(this.line.subarray(this.index), 0)
    if (this.index > 0) held.set(this.line.subarray(0, this.index), this.line.length - this.index)
    this.reset()
    return held
  }

  align(samples: Float32Array, sampleRate: number) {
    const length = Math.round((sampleRate * CAPTURE_DELAY_MS) / 1000)
    if (length <= 0) return samples
    if (!this.line || this.line.length !== length || this.rate !== sampleRate) {
      this.line = new Float32Array(length)
      this.index = 0
      this.rate = sampleRate
    }
    if (!this.scratch || this.scratch.length !== samples.length) this.scratch = new Float32Array(samples.length)
    for (let i = 0; i < samples.length; i++) {
      this.scratch[i] = this.line[this.index]
      this.line[this.index] = samples[i]
      this.index = (this.index + 1) % this.line.length
    }
    return this.scratch
  }
}
