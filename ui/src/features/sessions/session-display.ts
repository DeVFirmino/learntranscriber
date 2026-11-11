import type { SessionSummary } from '@/bridge/types/sessions'

export function sessionTime(value: string, language: string): string {
  return new Date(value).toLocaleTimeString(language, { hour: 'numeric', minute: '2-digit' })
}

export function sessionDate(value: string, language: string): string {
  return new Date(value).toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'short' })
}

// The first lines of a summary as plain text: headings are dropped and list and emphasis marks removed, so a card shows
// what was said rather than "## Overview".
export function summaryPreview(summary: string): string {
  return summary
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.replace(/^([-*+]|\d+\.)\s+/, '').replace(/[*_`]/g, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Whole minutes from start to end, at least one; an unfinished session has no duration yet.
export function durationMinutes(session: Pick<SessionSummary, 'started_at' | 'ended_at'>): number | null {
  if (!session.ended_at) return null
  const elapsed = Date.parse(session.ended_at) - Date.parse(session.started_at)
  if (!Number.isFinite(elapsed) || elapsed < 0) return null
  return Math.max(1, Math.round(elapsed / 60000))
}

export interface DayGroup<T> {
  day: 'today' | 'yesterday' | 'earlier'
  date: string
  sessions: T[]
}

const dayKey = (value: Date) => `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()}`

function dayOf(key: string, today: string, yesterday: string): DayGroup<unknown>['day'] {
  if (key === today) return 'today'
  if (key === yesterday) return 'yesterday'
  return 'earlier'
}

// Sessions arrive newest start first; each start day is collected once, in the order it first appears.
export function groupByDay<T extends Pick<SessionSummary, 'started_at'>>(sessions: T[], now: Date): DayGroup<T>[] {
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const groups = new Map<string, DayGroup<T>>()
  for (const session of sessions) {
    const started = new Date(session.started_at)
    const key = dayKey(started)
    const group = groups.get(key)
    if (group) {
      group.sessions.push(session)
      continue
    }
    groups.set(key, { day: dayOf(key, today, yesterday), date: session.started_at, sessions: [session] })
  }
  return [...groups.values()]
}
