import type { FollowUpSuggestion, GenerationApi } from '@/bridge/types/generation'
import type { NotchInsight } from '@/notch-history'

export interface InsightFollowUps {
  suggestions: FollowUpSuggestion[]
  busy: boolean
  loaded: boolean
  error: string
}
export type FollowUpsByInsight = Record<string, InsightFollowUps>

export interface NotchFollowUpsHooks {
  followUps: GenerationApi['followUps']
  cancel(requestId: string): Promise<unknown>
  update(change: (current: FollowUpsByInsight) => FollowUpsByInsight): void
  newId(): string
}

export interface FollowUpRequest {
  sessionId: string | null | undefined
  insight: NotchInsight | undefined
  enabled: boolean
  // Another answer is being generated in this window.
  busy: boolean
  // Shown when the request fails without a message of its own.
  failure: string
}

const IDLE: InsightFollowUps = { suggestions: [], busy: false, loaded: false, error: '' }

// Suggestions are offered only for an answer saved in the session and long enough to follow up on.
export function offersFollowUps(insight: NotchInsight | undefined): insight is NotchInsight & { entryId: string } {
  return Boolean(insight?.entryId && insight.text.trim().length >= 50)
}

// Follow-up suggestions for the Notch's insights: one request per insight at a time. A request is dropped when
// its insight leaves the history, the session changes or the feature is turned off.
export class NotchFollowUps {
  private requests = new Map<string, string>()
  private hooks: NotchFollowUpsHooks
  // The live session, checked when an answer arrives so one that belongs to a previous session is dropped.
  private session: string | null | undefined = undefined

  constructor(hooks: NotchFollowUpsHooks) {
    this.hooks = hooks
  }

  setSession(sessionId: string | null | undefined) {
    this.session = sessionId
  }

  async generate({ sessionId, insight, enabled, busy, failure }: FollowUpRequest): Promise<void> {
    if (!enabled || !sessionId || !offersFollowUps(insight) || busy || this.requests.has(insight.id)) return
    const hooks = this.hooks
    const itemId = insight.id,
      entryId = insight.entryId,
      requestId = hooks.newId()
    const current = () => this.requests.get(itemId) === requestId && this.session === sessionId
    this.requests.set(itemId, requestId)
    this.set(itemId, { ...IDLE, busy: true })
    try {
      const result = await hooks.followUps({ requestId, sessionId, entryId, historical: true })
      if (!current()) return
      // Suggestions about another answer are dropped and the insight goes back to idle, as in the session panel.
      this.set(
        itemId,
        result.entryId === entryId ? { suggestions: result.suggestions, busy: false, loaded: true, error: '' } : IDLE,
      )
    } catch (cause) {
      if (current()) this.set(itemId, { ...IDLE, error: cause instanceof Error ? cause.message : failure })
    } finally {
      if (this.requests.get(itemId) === requestId) this.requests.delete(itemId)
    }
  }

  cancel(insightId: string): void {
    const requestId = this.requests.get(insightId)
    if (requestId) {
      this.requests.delete(insightId)
      void this.hooks.cancel(requestId).catch(() => {})
    }
    this.set(insightId, IDLE)
  }

  // Forgets the suggestions of insights no longer in the history and cancels their requests.
  retain(ids: ReadonlySet<string>): void {
    this.hooks.update((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([id]) => ids.has(id)))
      return Object.keys(next).length === Object.keys(current).length ? current : next
    })
    for (const [id, requestId] of this.requests)
      if (!ids.has(id)) {
        void this.hooks.cancel(requestId).catch(() => {})
        this.requests.delete(id)
      }
  }

  cancelAll(): void {
    for (const requestId of this.requests.values()) void this.hooks.cancel(requestId).catch(() => {})
    this.requests.clear()
  }

  private set(itemId: string, value: InsightFollowUps) {
    this.hooks.update((current) => ({ ...current, [itemId]: value }))
  }
}
