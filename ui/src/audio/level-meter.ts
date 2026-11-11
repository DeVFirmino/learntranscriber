import type { AudioLevels } from '../bridge/types/audio'

const FLOOR_DB = -60,
  RANGE_DB = 50,
  // Each block keeps this share of the previous level, so the wave rises at once and falls gently.
  RELEASE = 0.85

// The loudness of a 16-bit block from 0 (silence, -60 dBFS) to 1 (-10 dBFS and louder).
export function blockLevel(samples: Int16Array) {
  if (!samples.length) return 0
  let sum = 0
  for (const sample of samples) sum += sample * sample
  const rms = Math.sqrt(sum / samples.length) / 32768
  if (rms <= 0) return 0
  return Math.min(1, Math.max(0, (20 * Math.log10(rms) - FLOOR_DB) / RANGE_DB))
}

// Each side's loudness for the floating bar's live wave, reported at most once per interval.
export class LevelMeter {
  private levels: AudioLevels = { me: 0, they: 0 }
  private last = -Infinity
  private report: (levels: AudioLevels) => void
  private now: () => number
  private intervalMs: number

  constructor(report: (levels: AudioLevels) => void, now = () => performance.now(), intervalMs = 80) {
    this.report = report
    this.now = now
    this.intervalMs = intervalMs
  }

  feed(speaker: string, samples: Int16Array) {
    const side = speaker === 'THEY' ? 'they' : 'me'
    this.levels = { ...this.levels, [side]: Math.max(blockLevel(samples), this.levels[side] * RELEASE) }
    const now = this.now()
    if (now - this.last < this.intervalMs) return
    this.last = now
    this.report(this.levels)
  }

  resetSpeaker(speaker: string) {
    const side = speaker === 'THEY' ? 'they' : 'me'
    this.levels = { ...this.levels, [side]: 0 }
    this.last = -Infinity
    this.report(this.levels)
  }

  // Silence on both sides, reported at once: the recording paused or ended.
  reset() {
    this.levels = { me: 0, they: 0 }
    this.last = -Infinity
    this.report(this.levels)
  }
}
