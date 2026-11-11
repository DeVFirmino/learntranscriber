import {
  AEC_SAMPLE_RATE,
  AUDIO_BUFFER_DELAY_MS,
  CAPTURE_DELAY_MS,
  REFERENCE_TIMEOUT_MS,
  type Aec3Instance,
  type Aec3Module,
} from './aec3'
import type { EchoReduction } from './echo-reduction'
import { append, usable } from './float-samples'
import { MicDelay } from './mic-delay'

// Reports the error's message when it has one; anything else is described as text.
const reason = (error: unknown) =>
  typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error)

// The microphone side: delays, then cancels, each block it is given.
export class EchoCapture {
  active = false
  failed = false
  released = false
  private aec: Aec3Instance | null = null
  private preparing: Promise<boolean> | null = null
  private output: Float32Array | null = null
  private readonly delay = new MicDelay()
  private lastReferenceAt = 0
  private hasReference = false
  private readyLogged = false
  private readonly bus: EchoReduction

  constructor(bus: EchoReduction) {
    this.bus = bus
  }

  private get wanted() {
    return !this.released && !this.failed && this.bus.enabled && this.bus.references.size > 0
  }

  private report(message: string) {
    try {
      this.bus.log(`[AEC3] ${message}`)
    } catch {
      // Logging must never interrupt audio.
    }
  }

  private fail(message: string) {
    this.failed = true
    this.active = false
    this.freeAec()
    this.resetCaptureDelay()
    this.report(message)
  }

  private createAec(module: Aec3Module | null) {
    if (!this.wanted || !module?.AEC3) return null
    this.aec = new module.AEC3(AEC_SAMPLE_RATE, 1, 1)
    if (AUDIO_BUFFER_DELAY_MS > 0) this.aec.setAudioBufferDelay?.(AUDIO_BUFFER_DELAY_MS)
    if (!this.readyLogged) {
      this.readyLogged = true
      this.report(`ready at ${AEC_SAMPLE_RATE} Hz with ${CAPTURE_DELAY_MS} ms microphone alignment`)
    }
    return this.aec
  }

  // Loads the module and creates the canceller once echo reduction is on and incoming audio exists.
  async prepare(): Promise<boolean> {
    if (!this.wanted) return false
    if (this.aec) return true
    this.preparing ||= this.bus
      .loadModule()
      .then((module) => {
        const aec = this.aec || this.createAec(module)
        if (!aec && this.wanted) this.fail('unavailable; using unprocessed microphone audio (AEC3 export missing)')
        return Boolean(aec)
      })
      .catch((error: unknown) => {
        this.fail(`unavailable; using unprocessed microphone audio (${reason(error)})`)
        return false
      })
      .finally(() => {
        this.preparing = null
      })
    return this.preparing
  }

  private freeAec() {
    try {
      this.aec?.free()
    } catch {
      // An instance that cannot be freed is dropped anyway.
    }
    this.aec = null
    this.output = null
    this.lastReferenceAt = 0
    this.hasReference = false
  }

  resetCaptureDelay() {
    this.delay.reset()
  }

  private processWith(samples: Float32Array | null, sampleRate: number, aec: Aec3Instance | null) {
    if (!samples || !aec) return samples
    try {
      const options = { sampleRateIn: sampleRate, sampleRateOut: sampleRate }
      const size = aec.processSize([samples], options)
      if (size <= 0) return samples
      const out = new Float32Array(size)
      aec.process([out], [samples], options)
      return out
    } catch (error) {
      this.fail(`capture processing failed; using unprocessed microphone audio (${reason(error)})`)
      return samples
    }
  }

  // With the last incoming source gone, the held-back audio is released once and the canceller freed.
  private finish(samples: Float32Array, sampleRate: number) {
    const held = this.processWith(this.delay.take(), sampleRate, this.hasReference ? this.aec : null)
    this.freeAec()
    return append(held, samples) as Float32Array
  }

  resetReference() {
    this.freeAec()
    if (this.wanted && this.bus.module) this.createAec(this.bus.module)
  }

  // The last incoming source went. With no held-back audio left to release, the canceller is freed now; otherwise
  // the next block releases that audio first.
  finishReference() {
    if (!this.delay.holding) this.freeAec()
  }

  // Pause and stop: the held-back audio is dropped and the canceller starts fresh.
  resetCapture() {
    if (this.released) return
    this.active = false
    this.resetCaptureDelay()
    this.resetReference()
  }

  analyzeReference(samples: Float32Array, sampleRate: number) {
    if (this.released || this.failed || !this.bus.enabled || !usable(samples)) return
    if (!this.aec) {
      void this.prepare()
      return
    }
    try {
      this.aec.analyze([samples], { sampleRateIn: sampleRate })
      this.lastReferenceAt = this.bus.now()
      this.hasReference = true
    } catch (error) {
      this.fail(`reference processing failed; using unprocessed microphone audio (${reason(error)})`)
    }
  }

  private freshReference() {
    return (
      this.bus.enabled &&
      this.hasReference &&
      this.bus.references.size > 0 &&
      this.bus.now() - this.lastReferenceAt <= REFERENCE_TIMEOUT_MS
    )
  }

  // One microphone block in, the delayed and echo-cancelled block out. The returned array may be reused by the
  // next call, so callers convert it before then.
  processFloat32(samples: Float32Array, sampleRate: number): Float32Array {
    if (this.released || !usable(samples)) return samples
    this.active = true
    if (!this.bus.enabled) {
      this.freeAec()
      this.resetCaptureDelay()
      return samples
    }
    if (this.failed) return samples
    if (this.bus.references.size === 0) return this.finish(samples, sampleRate)
    const aligned = this.delay.align(samples, sampleRate)
    if (!this.aec) {
      void this.prepare()
      return aligned
    }
    if (!this.freshReference()) {
      if (this.hasReference) this.resetReference()
      return aligned
    }
    const options = { sampleRateIn: sampleRate, sampleRateOut: sampleRate }
    try {
      const size = this.aec.processSize([aligned], options)
      if (size <= 0) return new Float32Array(0)
      if (!this.output || this.output.length !== size) this.output = new Float32Array(size)
      this.aec.process([this.output], [aligned], options)
      return this.output
    } catch (error) {
      this.fail(`capture processing failed; using unprocessed microphone audio (${reason(error)})`)
      return samples
    }
  }

  release() {
    if (this.released) return
    this.active = false
    this.released = true
    this.freeAec()
    this.resetCaptureDelay()
    this.bus.captures.delete(this)
  }
}
