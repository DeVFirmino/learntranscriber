// Notch modes control how readily each one offers an insight, how often it checks, whether it reads selected text, and when the user's own silence asks for help.
export type InsightMode = 'only_questions' | 'moderate' | 'proactive' | 'full_power' | 'meeting_notes'
export type InsightTrigger = 'question' | 'user-help' | 'periodic'

interface ModeConfig {
  sensitivity: number
  inviteMs: number | null
  selection: boolean
  periodicMs: number | null
  userSilence: { minUserMessages: number; silenceMs: number } | null
}

export const INSIGHT_MODES: Record<InsightMode, ModeConfig> = {
  only_questions: { sensitivity: 0, inviteMs: null, selection: false, periodicMs: null, userSilence: null },
  moderate: { sensitivity: 40, inviteMs: 90_000, selection: true, periodicMs: 90_000, userSilence: null },
  proactive: {
    sensitivity: 75,
    inviteMs: 30_000,
    selection: true,
    periodicMs: 30_000,
    userSilence: { minUserMessages: 2, silenceMs: 5_000 },
  },
  full_power: {
    sensitivity: 100,
    inviteMs: 15_000,
    selection: true,
    periodicMs: 15_000,
    userSilence: { minUserMessages: 1, silenceMs: 3_000 },
  },
  meeting_notes: { sensitivity: 100, inviteMs: 10_000, selection: false, periodicMs: 10_000, userSilence: null },
}

// A saved mode, with the older 'questions' name and anything unknown falling back to proactive.
export function insightMode(value: string): InsightMode {
  if (value === 'questions') return 'only_questions'
  return Object.hasOwn(INSIGHT_MODES, value) ? (value as InsightMode) : 'proactive'
}
