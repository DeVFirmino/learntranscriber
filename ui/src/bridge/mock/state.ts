// The preview's shared state, event hubs and fixtures. Every mock feature module reads and changes this one
// context, the way the native features share one database and event stream.
import type { Entry, SessionDetail } from '../types/sessions'
import { previewAssistants, previewSessions } from './library-fixtures'
import { previewPng, setOverlay } from './preview-browser'
import { buildPublicState } from './public-state'
import { previewSettings } from './settings-fixture'
import { createMockEvents } from './events'
import { emptyLocal } from './local-state-fixture'
import { previewUpdateStatus } from './updates-fixture'
import { createWordStream } from './word-stream'

export interface MockState {
  notchExpanded: boolean
  notchBounds: { x: number; y: number; width: number; height: number }
  overlayExpanded: boolean
  listening: { active: boolean; starting?: boolean; paused?: boolean; since: number | null }
  runtimeInstalls: { kind: string; progress: string }[]
  customHeaders: { key: string; value: string }[]
  activeSessionId: string | null
  activeAccount: string | null
  concealed: boolean
}

export function createMockContext() {
  // Everything the preview can change after start-up lives here, so feature modules share one copy.
  const state: MockState = {
    notchExpanded: false,
    notchBounds: { x: 470, y: 8, width: 84, height: 48 },
    overlayExpanded: true,
    listening: { active: false, starting: false, since: null },
    runtimeInstalls: [],
    customHeaders: [],
    activeSessionId: null,
    activeAccount: null,
    concealed: false,
  }
  const events = createMockEvents()
  const jobs = new Map<string, { cancelled: boolean }>()
  const stream = createWordStream(jobs, events)

  const settings = previewSettings()
  const credentials: Record<string, boolean> = { custom: true }
  const assistants = previewAssistants()
  const { study, planning } = previewSessions()
  const sessions = new Map<string, SessionDetail>([
    [study.id, study],
    [planning.id, planning],
  ])
  const local = emptyLocal()
  const accounts: { id: string; label: string; authenticated: boolean }[] = []
  const updateStatus = previewUpdateStatus()

  const publicState = () =>
    buildPublicState({
      state,
      settings,
      credentials,
      assistants,
      sessions,
      local,
      accounts,
    })

  function emit() {
    events.changes.emit(publicState())
  }

  function emitLocal() {
    const value = structuredClone(local)
    events.localChanges.emit(value)
    emit()
    return value
  }

  function requireSession(id: string) {
    const session = sessions.get(id)
    if (!session) throw new Error('Session not found.')
    return session
  }

  function addEntry(
    sessionId: string,
    kind: string,
    content: string,
    speaker = '',
    generation?: { mode: string; requestId: string },
  ): Entry {
    const session = requireSession(sessionId)
    const entry: Entry = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      kind,
      generation_mode: generation?.mode ?? null,
      request_id: generation?.requestId ?? null,
      speaker,
      content,
      created_at: new Date().toISOString(),
    }
    session.entries.push(entry)
    return entry
  }

  return {
    state,
    ...events,
    jobs,
    settings,
    credentials,
    assistants,
    sessions,
    study,
    planning,
    local,
    accounts,
    updateStatus,
    publicState,
    emit,
    emitLocal,
    requireSession,
    addEntry,
    stream,
    setOverlay,
    previewPng,
  }
}

export type MockContext = ReturnType<typeof createMockContext>
