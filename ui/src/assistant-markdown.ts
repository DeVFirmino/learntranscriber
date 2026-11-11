import type { AssistantDraft } from '@/bridge/types/assistants'

export function assistantDraftFromMarkdown(name: string, content: string): AssistantDraft {
  if (!/\.md$/i.test(name)) throw new Error('Choose a Markdown (.md) prompt file.')
  const assistantName = name.slice(0, -3).trim()
  if (!assistantName || assistantName.length > 80 || /\p{Cc}/u.test(assistantName))
    throw new Error('Use a Markdown filename up to 80 characters for the assistant name.')
  if (!content.trim() || content.length > 20000 || content.includes('\u0000'))
    throw new Error('The Markdown prompt must contain text and be at most 20,000 characters.')
  return {
    name: assistantName,
    category: 'Uncategorized',
    systemPrompt: content.trim(),
    realtimePrompt: '',
    followUpPrompt: '',
    emailPrompt: '',
    requireCertainty: false,
  }
}
