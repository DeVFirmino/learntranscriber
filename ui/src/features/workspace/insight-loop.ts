import type { PublicState } from '@/bridge/types/state'
import type { HesitationMonitor } from './hesitation-monitor'
import { INSIGHT_MODES, insightMode, type InsightTrigger } from './insight-modes'
import type { HeardLine, InsightScheduler } from './insight-scheduler'

export interface ListeningSession {
  sessionId: string
  lines: HeardLine[]
}

export interface InsightLoopHooks {
  scheduler: Pick<InsightScheduler, 'reset' | 'decide' | 'requested' | 'completed' | 'failed' | 'question'>
  hesitation: Pick<HesitationMonitor, 'update' | 'reset'>
  state(): PublicState | null
  recording(): boolean
  paused(): boolean
  // The listening session's saved lines, as last loaded.
  listening(): ListeningSession | null
  load(sessionId: string): Promise<unknown>
  // What each speaker is saying right now.
  captions(): Record<string, string>
  // Another answer is being generated in this window.
  generating(): boolean
  generate(question: string | undefined, liveTranscript: string, trigger: LiveTrigger): Promise<string>
  failed(error: unknown): void
  now(): number
  every(ms: number, run: () => void): () => void
}

const TICK_MS = 1_000
// The trigger names for what started a request; a periodic check is an "invitation".
export type LiveTrigger = 'manual' | 'question' | 'they-question' | 'invitation' | 'user-help'
const LIVE_TRIGGERS: Record<InsightTrigger, LiveTrigger> = {
  question: 'question',
  'user-help': 'user-help',
  periodic: 'invitation',
}

// The speakers with text, one per line, ending at the newest 20,000 characters.
export function liveTranscript(captions: Record<string, string>): string {
  return Object.entries(captions)
    .filter(([, text]) => text.trim())
    .map(([speaker, text]) => `${speaker}: ${text}`)
    .join('\n')
    .slice(-20000)
}

// Live insights while listening: every second the scheduler decides, from the saved lines, what is being said now
// and whether the user is hesitating, if the listening session deserves an insight; one runs at a time.
export class InsightLoop {
  private run: string | null = null
  private running = false
  private hooks: InsightLoopHooks

  constructor(hooks: InsightLoopHooks) {
    this.hooks = hooks
  }

  start(): () => void {
    const stop = this.hooks.every(TICK_MS, () => void this.tick())
    return () => {
      stop()
      this.hooks.hesitation.reset()
    }
  }

  async tick(): Promise<void> {
    const hooks = this.hooks
    const current = hooks.state()
    const listening = hooks.listening()
    if (!hooks.recording() || hooks.paused() || !current?.settings.autoInsights || !current.activeSessionId) {
      this.run = null
      hooks.hesitation.reset()
      return
    }
    if (!listening || listening.sessionId !== current.activeSessionId) {
      await hooks.load(current.activeSessionId).catch(() => {})
      return
    }
    const now = hooks.now()
    // A new listening run starts from what is already saved.
    if (this.run !== current.activeSessionId) {
      this.run = current.activeSessionId
      hooks.hesitation.reset()
      hooks.scheduler.reset(listening.lines.length, now)
      return
    }
    const hesitating = await hooks.hesitation.update({
      sessionId: current.activeSessionId,
      text: hooks.captions().ME || '',
      enabled: Boolean(INSIGHT_MODES[insightMode(current.settings.insightMode)].userSilence),
      now,
    })
    const latest = hooks.state()
    if (
      !hooks.recording() ||
      latest?.activeSessionId !== current.activeSessionId ||
      !latest.settings.autoInsights ||
      latest.settings.insightMode !== current.settings.insightMode
    )
      return
    const trigger = hooks.scheduler.decide({
      now: hooks.now(),
      mode: current.settings.insightMode,
      lines: listening.lines,
      live: hooks.captions(),
      inFlight: this.running || hooks.generating(),
      isMeHesitating: hesitating,
    })
    if (!trigger) return
    hooks.scheduler.requested(listening.lines.length, hooks.now())
    this.running = true
    try {
      const text = await hooks.generate(
        hooks.scheduler.question || undefined,
        liveTranscript(hooks.captions()),
        LIVE_TRIGGERS[trigger],
      )
      hooks.scheduler.completed(Boolean(text.trim()))
    } catch (error) {
      hooks.scheduler.failed(hooks.now())
      hooks.failed(error)
    } finally {
      this.running = false
    }
  }
}
