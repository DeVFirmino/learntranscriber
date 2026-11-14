import type { SessionDetail, SessionsApi } from '../types/sessions'
import type { MockContext } from './state'
import { text } from './input-validation'
import { sessionHistoryApi } from './session-history'
import { sessionSearchApi } from './session-search'

// Session lifecycle with the same guards as the native app: one live session, no deleting it, optimistic overview
// saves. Search, paging and whole-history operations are composed in from their own modules.
export function sessionsApi(ctx: MockContext) {
  const { state, settings, assistants, sessions, emit, requireSession, addEntry } = ctx
  const api: SessionsApi = {
    ...sessionSearchApi(ctx),
    ...sessionHistoryApi(ctx),
    session: async (id) => structuredClone(requireSession(id)),
    renameSession: async ({ id, title }) => {
      const session = requireSession(id)
      session.title = text(title, 120)
      emit()
      return structuredClone(session)
    },
    updateSummary: async ({ id, summary, expectedSummary }) => {
      const session = requireSession(id)
      if (
        typeof summary !== 'string' ||
        summary.length > 200000 ||
        typeof expectedSummary !== 'string' ||
        expectedSummary.length > 200000
      )
        throw new Error('Invalid overview update.')
      if (session.summary !== expectedSummary)
        throw new Error('Overview changed in another window. Reload it or explicitly replace it.')
      session.summary = summary.trim()
      emit()
      return structuredClone(session)
    },
    createSession: async (title) => {
      if (state.activeSessionId) throw new Error('End the active session before creating another.')
      const assistantId = settings.assistantId
      if (!assistants.some((assistant) => assistant.id === assistantId))
        throw new Error('Choose an existing assistant.')
      // Automatic Apple Speech is named by its languages, as the native session rules do.
      const speechLanguage = settings.appleSpeechLocale === 'auto' ? 'Auto EN + PT' : settings.appleSpeechLocale
      const session: SessionDetail = {
        id: crypto.randomUUID(),
        title: text(title || 'Untitled session', 200),
        assistant_id: assistantId,
        started_at: new Date().toISOString(),
        ended_at: null,
        summary: '',
        translation: '',
        provider: settings.provider,
        model: settings.model || null,
        analysis_model_source: settings.provider,
        transcription_model:
          settings.transcriptionProvider === 'apple'
            ? `Apple Speech (${speechLanguage})`
            : settings.transcriptionModel || null,
        assistant_name: assistants.find((assistant) => assistant.id === assistantId)?.name || null,
        entries: [],
        context: [],
      }
      sessions.set(session.id, session)
      state.activeSessionId = session.id
      emit()
      return structuredClone(session)
    },
    resumeSession: async (id) => {
      if (state.activeSessionId && state.activeSessionId !== id) throw new Error('End the active session first.')
      const session = requireSession(id)
      session.ended_at = null
      state.activeSessionId = id
      emit()
      return structuredClone(session)
    },
    endSession: async (id) => {
      const session = requireSession(id)
      session.ended_at = new Date().toISOString()
      if (state.activeSessionId === id) state.activeSessionId = null
      emit()
      return structuredClone(session)
    },
    deleteSession: async (id) => {
      if (state.activeSessionId === id) throw new Error('End the session before deleting it.')
      sessions.delete(id)
      emit()
      return true
    },
    deleteSessions: async (ids) => {
      if (!Array.isArray(ids) || !ids.length || ids.length > 200) throw new Error('Choose sessions to delete.')
      const selected = [...new Set(ids.map((id) => text(id, 100)))]
      if (selected.includes(state.activeSessionId || '')) throw new Error('End the session before deleting it.')
      for (const id of selected) sessions.delete(id)
      emit()
      return selected.length
    },
    appendTranscript: async (input) => {
      if (!['ME', 'THEY'].includes(input.speaker)) throw new Error('Invalid speaker.')
      const entry = addEntry(input.sessionId, 'transcript', text(input.text, 100000), input.speaker)
      emit()
      return entry
    },
  }
  return api
}
