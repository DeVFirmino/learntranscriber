import type { ShortcutDefinition } from '@/bridge/types/settings'

// The workspace state carries at most this many sessions, so a full list means there may be more.
export const SESSION_LIST_LIMIT = 200

// How many sessions exist, whether the count is capped by the list, and how many started on the last seven calendar
// days, the same days the activity chart draws.
export function sessionStats(sessions: { started_at: string }[], now: number) {
  const thisWeek = sessionsPerDay(sessions, now).reduce((sum, item) => sum + item.count, 0)
  return { total: sessions.length, capped: sessions.length >= SESSION_LIST_LIMIT, thisWeek }
}

// Sessions started on each of the last `days` local calendar days, oldest first, ending today.
export function sessionsPerDay(sessions: { started_at: string }[], now: number, days = 7) {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const counts = Array.from({ length: days }, (_, index) => {
    const day = new Date(today)
    day.setDate(today.getDate() - (days - 1 - index))
    return { day: day.getTime(), count: 0 }
  })
  for (const session of sessions) {
    const started = new Date(session.started_at)
    if (Number.isNaN(started.getTime()) || started.getTime() > now) continue
    started.setHours(0, 0, 0, 0)
    const slot = counts.find((item) => item.day === started.getTime())
    if (slot) slot.count += 1
  }
  return counts
}

const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
}

// The provider as the Home setup names it: a brand, or null for the local and custom choices the caller translates.
export function providerName(provider: string): string | null {
  return Object.hasOwn(PROVIDER_NAMES, provider) ? PROVIDER_NAMES[provider] : null
}

// Where speech becomes text: Apple Speech with its language, a local Whisper, the named cloud provider, or null for a
// custom endpoint the caller translates.
export function transcriptionName(settings: { transcriptionProvider: string; appleSpeechLocale: string }) {
  if (settings.transcriptionProvider === 'apple') return `Apple Speech · ${settings.appleSpeechLocale || 'en-US'}`
  if (settings.transcriptionProvider === 'local') return 'Whisper · local'
  return providerName(settings.transcriptionProvider)
}

// The few shortcuts Home teaches, in the order a session uses them, skipping any that are off or unbound.
const HOME_SHORTCUTS = ['overlay', 'record', 'ask', 'capture']
export function homeShortcuts(definitions: ShortcutDefinition[]) {
  return HOME_SHORTCUTS.map((id) => definitions.find((item) => item.id === id)).filter(
    (item): item is ShortcutDefinition => Boolean(item && item.enabled && item.accelerator),
  )
}
