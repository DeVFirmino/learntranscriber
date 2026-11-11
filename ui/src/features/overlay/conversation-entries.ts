import type { Entry } from '@/bridge/types/sessions'
import { isSilentAnswer } from './silent-answer'

export interface ConversationEntry {
  entry: Entry
  role: 'user' | 'assistant' | 'context'
}

export function generatedRole(mode?: string | null): 'assistant' | 'context' {
  return mode === 'insight' || mode === 'screenInsight' ? 'context' : 'assistant'
}

// Transcribed speech stays on the Transcript tab; only typed questions are user turns.
export function conversationEntries(entries: Entry[], sessionId: string): ConversationEntry[] {
  const result: ConversationEntry[] = []
  let questionWaiting = false
  const seen = new Set<string>()
  for (const entry of entries) {
    if (entry.session_id !== sessionId || seen.has(entry.id) || !entry.content.trim()) continue
    seen.add(entry.id)
    if (entry.kind === 'user') {
      result.push({ entry, role: 'user' })
      questionWaiting = !entry.request_id
    } else if (entry.kind === 'assistant' && !isSilentAnswer(entry.content)) {
      let role: ConversationEntry['role'] = questionWaiting ? 'assistant' : 'context'
      if (entry.generation_mode) role = generatedRole(entry.generation_mode)
      result.push({ entry, role })
      questionWaiting = false
    }
  }
  return result
}
