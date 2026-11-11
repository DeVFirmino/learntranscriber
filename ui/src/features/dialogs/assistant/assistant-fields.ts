import type { Assistant, AssistantDraft, KnowledgeFile } from '../../../bridge/types/assistants'
import type { MessageKey } from '../../../i18n'

export const MAX_FILES = 20
const MAX_FILE_BYTES = 1_000_000
const MAX_KNOWLEDGE_CHARACTERS = 200_000

// The fields an assistant opens with: the builder's draft first, then the saved assistant, then the empty defaults.
export function initialFields(draft: AssistantDraft | undefined, current: Assistant | undefined, category?: string) {
  return {
    category: draft?.category || current?.category || category || 'Uncategorized',
    realtimePrompt: draft?.realtimePrompt || current?.realtime_prompt || '',
    followUpPrompt: draft?.followUpPrompt || current?.follow_up_prompt || '',
    emailPrompt: draft?.emailPrompt || current?.email_prompt || '',
    context: draft?.context || current?.context || '',
    knowledgeFiles: draft?.knowledgeFiles || current?.knowledge_files || ([] as KnowledgeFile[]),
    requireCertainty: draft?.requireCertainty ?? current?.require_certainty ?? false,
  }
}
export type AssistantFields = ReturnType<typeof initialFields>

// Whether a picked file can be read at all: twenty files of up to 1 MB each, with a plain name.
export function fileProblem(file: { name: string; size: number }, count: number): MessageKey | null {
  if (count >= MAX_FILES || file.size > MAX_FILE_BYTES || file.size === 0) return 'assistantDialog.limit'
  if (!file.name.trim() || file.name.length > 200 || [...file.name].some((letter) => letter.charCodeAt(0) < 32))
    return 'assistantDialog.invalidName'
  return null
}

// Whether a file's text can join the knowledge: no binary content, and 200,000 characters in all.
export function contentProblem(content: string, files: KnowledgeFile[]): MessageKey | null {
  const total = files.reduce((sum, item) => sum + item.content.length, 0)
  return content.includes('\u0000') || total + content.length > MAX_KNOWLEDGE_CHARACTERS
    ? 'assistantDialog.unreadable'
    : null
}
