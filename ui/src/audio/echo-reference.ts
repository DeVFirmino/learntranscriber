import type { EchoReduction } from './echo-reduction'
import { usable } from './float-samples'

// The incoming side: every block it is given becomes the echo reference of the active microphones.
export class EchoReference {
  released = false
  private scratch: Float32Array | null = null
  private readonly bus: EchoReduction

  constructor(bus: EchoReduction) {
    this.bus = bus
  }

  analyzeFloat32(samples: Float32Array, sampleRate: number) {
    if (!this.released && this.bus.enabled && usable(samples)) this.bus.broadcast(samples, sampleRate)
    return samples
  }

  analyzePCM16(samples: Int16Array, sampleRate: number) {
    if (this.released || !this.bus.enabled || !(samples instanceof Int16Array) || !samples.length) return samples
    if (!this.scratch || this.scratch.length !== samples.length) this.scratch = new Float32Array(samples.length)
    for (let i = 0; i < samples.length; i++) this.scratch[i] = samples[i] / 32768
    this.bus.broadcast(this.scratch, sampleRate)
    return samples
  }

  // When the last incoming source goes, the microphones release their held-back audio and free their cancellers.
  release() {
    if (this.released) return
    this.released = true
    this.scratch = null
    this.bus.references.delete(this)
    if (this.bus.references.size === 0) for (const capture of this.bus.captures) capture.finishReference()
  }
}
