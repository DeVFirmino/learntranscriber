export type DemoPhase = 'idle' | 'transcribing' | 'question' | 'insight'
export interface DemoFrame {
  phase: DemoPhase
  transcript: string
  progress: number
}

export function demoFrame(elapsed: number | null, phrase: string, reducedMotion = false): DemoFrame {
  if (elapsed === null) return { phase: 'idle', transcript: '', progress: 0 }
  const words = phrase.trim().split(/\s+/)
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0
  const transcribing = reducedMotion ? 800 : Math.max(2200, words.length * 160)
  const duration = transcribing + 1200
  if (time >= duration) return { phase: 'insight', transcript: phrase, progress: 100 }
  if (time >= transcribing) return { phase: 'question', transcript: phrase, progress: 85 }
  const count = Math.max(1, Math.ceil((time / transcribing) * words.length))
  let transcript = words.slice(0, count).join(' ')
  if (reducedMotion) transcript = phrase
  return { phase: 'transcribing', transcript, progress: Math.round((time / transcribing) * 80) }
}

// The clock and scheduler belong to the renderer; cancelling also guards an already queued callback.
export function playDemo<T>({
  phrase,
  reducedMotion,
  now,
  schedule,
  cancel,
  onFrame,
}: {
  phrase: string
  reducedMotion: boolean
  now: () => number
  schedule: (callback: () => void, delay: number) => T
  cancel: (handle: T) => void
  onFrame: (frame: DemoFrame) => void
}) {
  const started = now()
  let stopped = false
  let timer: T
  const tick = () => {
    if (stopped) return
    const frame = demoFrame(now() - started, phrase, reducedMotion)
    onFrame(frame)
    if (frame.phase !== 'insight') timer = schedule(tick, 160)
  }
  timer = schedule(tick, 160)
  return () => {
    stopped = true
    cancel(timer)
  }
}
