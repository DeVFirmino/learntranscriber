import type { Assistant, AssistantDraft } from '../../bridge/types/assistants'
import { categoryOf } from '../assistant-catalog'

// A copy of an assistant as an unsaved draft under a new name, with every prompt, its context and knowledge.
export function duplicateDraft(assistant: Assistant, name: string): AssistantDraft {
  return {
    name,
    category: categoryOf(assistant),
    systemPrompt: assistant.prompt,
    realtimePrompt: assistant.realtime_prompt || '',
    followUpPrompt: assistant.follow_up_prompt || '',
    emailPrompt: assistant.email_prompt || '',
    context: assistant.context || '',
    knowledgeFiles: assistant.knowledge_files || [],
    requireCertainty: assistant.require_certainty === true,
  }
}
