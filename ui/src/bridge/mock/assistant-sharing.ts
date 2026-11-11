import type { AssistantDraft, AssistantsApi } from '../types/assistants'
import type { MockContext } from './state'

// The clipboard share format: export copies a JSON envelope, import parses and validates one pasted back.
export function assistantSharingApi(ctx: MockContext) {
  const { actions, assistants, setOverlay } = ctx
  const api: Pick<AssistantsApi, 'exportAssistant' | 'importAssistant' | 'openAssistantLibrary'> = {
    exportAssistant: async (id) => {
      const assistant = assistants.find((item) => item.id === id)
      if (!assistant) throw new Error('Assistant not found.')
      const shared = {
        type: 'learntranscriber.assistant-prompt',
        version: 1,
        assistant: {
          name: assistant.name,
          category: assistant.category || 'Uncategorized',
          systemPrompt: assistant.prompt,
          realtimePrompt: assistant.realtime_prompt || '',
          followUpPrompt: assistant.follow_up_prompt || '',
          emailPrompt: assistant.email_prompt || '',
          requireCertainty: assistant.require_certainty === true,
        },
      }
      await navigator.clipboard.writeText(JSON.stringify(shared, null, 2))
      return true
    },
    importAssistant: async (input) => {
      const raw = String(input || '')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim()
      if (!raw) throw new Error('Paste a shared assistant prompt to import it.')
      if (raw.length > 250000) throw new Error('This shared prompt is too large to import.')
      let envelope: unknown
      try {
        envelope = JSON.parse(raw)
      } catch {
        throw new Error('That is not a valid shared assistant prompt.')
      }
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope))
        throw new Error('This shared prompt uses an unsupported format.')
      const packageValue = envelope as { type?: unknown; version?: unknown; assistant?: unknown }
      if (
        packageValue.type !== 'learntranscriber.assistant-prompt' ||
        packageValue.version !== 1 ||
        !packageValue.assistant ||
        typeof packageValue.assistant !== 'object' ||
        Array.isArray(packageValue.assistant)
      )
        throw new Error('This shared prompt uses an unsupported format.')
      const source = packageValue.assistant as Record<string, unknown>
      const fields = ['name', 'systemPrompt', 'realtimePrompt', 'followUpPrompt', 'emailPrompt'] as const
      if (fields.some((key) => source[key] !== undefined && typeof source[key] !== 'string'))
        throw new Error('This shared prompt contains invalid prompt fields.')
      const draft = Object.fromEntries(fields.map((key) => [key, source[key] || ''])) as unknown as AssistantDraft
      return {
        ...draft,
        category:
          typeof source.category === 'string' && source.category.trim() ? source.category.trim() : 'Uncategorized',
        requireCertainty: source.requireCertainty === true,
      }
    },
    openAssistantLibrary: async () => {
      setOverlay(false)
      window.setTimeout(() => actions.emit('openAssistants'), 0)
      return true
    },
  }
  return api
}
