import type { SessionsApi } from '../types/sessions'
import type { MockContext } from './state'
import { summaryOf } from './session-text'

// The same default-title rule as the native history page.
const DEFAULT_TITLE = /^(Conversation|Conversa|Conversación) · \S+$/

// Finds sessions by title, summary or content, for the quick search box and the paged history list.
export function sessionSearchApi(ctx: MockContext) {
  const { state, sessions } = ctx
  return {
    sessions: async (query = '') => {
      const phrase = String(query).trim().toLocaleLowerCase().slice(0, 500)
      return [...sessions.values()]
        .filter(
          (session) =>
            !phrase ||
            `${session.title} ${session.summary} ${session.entries.map((entry) => entry.content).join(' ')}`
              .toLocaleLowerCase()
              .includes(phrase),
        )
        .map(summaryOf)
        .sort((a, b) => b.started_at.localeCompare(a.started_at))
    },
    sessionsPage: async (options: Parameters<SessionsApi['sessionsPage']>[0] = {}) => {
      const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(200, Math.trunc(options.limit!))) : 20
      const offset = Number.isFinite(options.offset) ? Math.max(0, Math.trunc(options.offset!)) : 0
      const phrase = (options.search || '').trim().toLocaleLowerCase()
      const matches = [...sessions.values()]
        .filter(
          (session) =>
            (options.excludeActive === false || session.id !== state.activeSessionId) &&
            (!phrase ||
              `${session.title} ${session.summary} ${session.entries
                .filter((entry) => options.scope !== 'conversation' || entry.kind !== 'transcript')
                .map((entry) => entry.content)
                .join(' ')}`
                .toLocaleLowerCase()
                .includes(phrase)),
        )
        .map((session) => ({
          ...summaryOf(session),
          entry_count: session.entries.filter((entry) => ['transcript', 'user', 'assistant'].includes(entry.kind))
            .length,
          untitled: DEFAULT_TITLE.test(session.title),
        }))
        .sort(
          (a, b) =>
            Number(b.ended_at === null) - Number(a.ended_at === null) ||
            b.started_at.localeCompare(a.started_at) ||
            b.id.localeCompare(a.id),
        )
      return { sessions: matches.slice(offset, offset + limit), total: matches.length, limit, offset }
    },
  }
}
