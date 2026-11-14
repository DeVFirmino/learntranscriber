// Incoming audio (THEY) is the echo reference. The microphone (ME) is delayed 200 ms so the reference arrives
// first. When AEC3 cannot load or fails, microphone audio passes through unprocessed.

import type { Aec3Module } from './aec3'
import { EchoCapture } from './echo-capture'
import { EchoReference } from './echo-reference'

export interface EchoReductionOptions {
  load: () => Promise<Aec3Module>
  now?: () => number
  log?: (message: string) => void
}

// The window's echo reduction: the user's switch, the loaded module, and the microphones and incoming sources
// recording now. Every incoming block becomes the reference of the active microphones.
export class EchoReduction {
  enabled = false
  module: Aec3Module | null = null
  readonly captures = new Set<EchoCapture>()
  readonly references = new Set<EchoReference>()
  readonly now: () => number
  readonly log: (message: string) => void
  private readonly load: () => Promise<Aec3Module>
  private modulePromise: Promise<Aec3Module> | null = null

  constructor({ load, now = () => performance.now(), log = (message) => console.warn(message) }: EchoReductionOptions) {
    this.load = load
    this.now = now
    this.log = log
  }

  // The user's switch. Turning it off frees every canceller and drops the held-back microphone audio.
  setEnabled(enabled: boolean) {
    if (enabled === this.enabled) return
    this.enabled = enabled
    for (const capture of this.captures) {
      capture.resetReference()
      if (!enabled) capture.resetCaptureDelay()
    }
  }

  async loadModule() {
    if (this.module) return this.module
    this.modulePromise ||= this.load().then(
      (module) => (this.module = module),
      (error: unknown) => {
        this.modulePromise = null
        throw error
      },
    )
    return this.modulePromise
  }

  capture() {
    const capture = new EchoCapture(this)
    this.captures.add(capture)
    return capture
  }

  reference() {
    const reference = new EchoReference(this)
    this.references.add(reference)
    return reference
  }

  broadcast(samples: Float32Array, sampleRate: number) {
    for (const capture of this.captures) if (capture.active) capture.analyzeReference(samples, sampleRate)
  }
}
