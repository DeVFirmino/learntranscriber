import type { MockContext } from './state'
import { markdown } from './session-text'

// Whole-history operations: compaction is unavailable here, while stats, clearing and export run locally.
export function sessionHistoryApi(ctx: MockContext) {
  const { state, sessions, emit, requireSession } = ctx
  return {
    undoCompaction: async () => ({ summary: '', createdAt: null, estimatedTokens: 0, count: 0 }),
    historyStats: async () => {
      const entries = [...sessions.values()].flatMap((session) => session.entries)
      return {
        totalSessions: sessions.size,
        totalMessages: entries.filter((entry) => entry.kind !== 'transcript').length,
        totalTranscriptions: entries.filter((entry) => entry.kind === 'transcript').length,
        activeSessions: [...sessions.values()].filter((session) => !session.ended_at).length,
      }
    },
    clearHistory: async () => {
      if (state.activeSessionId) throw new Error('End the active session before clearing history.')
      const entries = [...sessions.values()].flatMap((session) => session.entries)
      const result = {
        sessions: sessions.size,
        messages: entries.filter((entry) => entry.kind !== 'transcript').length,
        transcriptions: entries.filter((entry) => entry.kind === 'transcript').length,
      }
      sessions.clear()
      emit()
      return result
    },
    // The browser preview has no Finder; it accepts the same folder names as the app.
    revealAppFolder: async (name: string) => {
      if (!['data', 'logs'].includes(name)) throw new Error('Unknown folder.')
      return true
    },
    exportSession: async (id: string) => {
      const blob = new Blob([markdown(requireSession(id))], { type: 'text/markdown' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'session.md'
      link.click()
      URL.revokeObjectURL(link.href)
      return true
    },
  }
}
