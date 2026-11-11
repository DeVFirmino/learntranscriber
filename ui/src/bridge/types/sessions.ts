export interface HistoryStats {
  totalSessions: number
  totalMessages: number
  totalTranscriptions: number
  activeSessions: number
}

export interface SessionSummary {
  id: string
  title: string
  assistant_id: string
  started_at: string
  ended_at: string | null
  summary: string
  translation: string
  provider?: string | null
  model?: string | null
  analysis_model_source?: string | null
  transcription_model?: string | null
  assistant_name?: string | null
  // Present on history pages: how many transcript and chat entries it has, and whether it still has the default title.
  entry_count?: number
  untitled?: boolean
}

export interface SessionPage {
  sessions: SessionSummary[]
  total: number
  limit: number
  offset: number
}

export interface Entry {
  id: string
  session_id: string
  kind: string
  generation_mode?: string | null
  request_id?: string | null
  speaker: string
  content: string
  created_at: string
}

export interface ContextItem {
  id: string
  session_id: string
  source: string
  content: string
  created_at: string
}

export interface CompactionState {
  summary: string
  createdAt: string | null
  estimatedTokens: number
  count: number
}

export interface SessionDetail extends SessionSummary {
  compaction?: CompactionState
  entries: Entry[]
  context: ContextItem[]
}

export interface SessionsApi {
  undoCompaction: (id: string) => Promise<CompactionState>
  sessions: (query?: string) => Promise<SessionSummary[]>
  sessionsPage: (options?: {
    limit?: number
    offset?: number
    search?: string
    excludeActive?: boolean
    scope?: 'conversation' | 'all'
  }) => Promise<SessionPage>
  session: (id: string) => Promise<SessionDetail>
  renameSession: (input: { id: string; title: string }) => Promise<SessionDetail>
  updateSummary: (input: { id: string; summary: string; expectedSummary: string }) => Promise<SessionDetail>
  createSession: (title: string) => Promise<SessionDetail>
  resumeSession: (id: string) => Promise<SessionDetail>
  endSession: (id: string) => Promise<SessionDetail>
  deleteSession: (id: string) => Promise<boolean>
  deleteSessions: (ids: string[]) => Promise<number>
  historyStats: () => Promise<HistoryStats>
  clearHistory: () => Promise<{ sessions: number; messages: number; transcriptions: number }>
  revealAppFolder: (name: 'data' | 'logs') => Promise<boolean>
  exportSession: (id: string) => Promise<boolean>
  appendTranscript: (input: { sessionId: string; speaker: string; text: string }) => Promise<Entry>
}
