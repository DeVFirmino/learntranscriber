import type { AssistantsApi } from '../types/assistants'
import type { Assistant } from '../types/assistants'
import type { MockContext } from './state'
import { text } from './input-validation'
import { previewBuiltIn, previewBuiltIns } from './library-fixtures'

function fallbackAssistantId(assistants: Assistant[]) {
  const general = assistants.find((assistant) => assistant.id === 'general')
  if (general) return general.id
  return assistants.reduce((first, item) => (item.name < first.name ? item : first)).id
}

// Create, update and delete assistants in the library, and choose which built-ins to keep. The last assistant stays.
export function assistantLibraryApi(ctx: MockContext) {
  const { settings, assistants, emit } = ctx
  const api: Pick<AssistantsApi, 'saveAssistant' | 'deleteAssistant' | 'chooseBuiltInAssistants'> = {
    saveAssistant: async (input) => {
      const name = text(input.name, 80)
      const prompt = text(input.prompt, 20000)
      if (
        assistants.some(
          (item) =>
            item.id !== input.id &&
            item.name.normalize('NFKC').trim().toLowerCase() === name.normalize('NFKC').trim().toLowerCase(),
        )
      )
        throw new Error('An assistant with this name already exists. Choose another name.')
      const id = input.id || crypto.randomUUID()
      const existing = assistants.find((assistant) => assistant.id === id)
      const details = {
        category: input.category || 'Uncategorized',
        realtime_prompt: input.realtimePrompt || '',
        follow_up_prompt: input.followUpPrompt || '',
        email_prompt: input.emailPrompt || '',
        context: input.context || '',
        require_certainty: input.requireCertainty === true,
        knowledge_files: input.knowledgeFiles || existing?.knowledge_files || [],
      }
      if (existing) {
        existing.name = name
        existing.prompt = prompt
        Object.assign(existing, details)
      } else assistants.push({ id, name, prompt, ...details })
      emit()
      return id
    },
    deleteAssistant: async (id) => {
      const index = assistants.findIndex((assistant) => assistant.id === id)
      if (index < 0) throw new Error('Assistant not found.')
      if (assistants.length === 1) throw new Error('Keep at least one assistant.')
      assistants.splice(index, 1)
      if (settings.assistantId === id) settings.assistantId = fallbackAssistantId(assistants)
      emit()
      return { selectedAssistantId: settings.assistantId }
    },
    chooseBuiltInAssistants: async (ids) => {
      const catalog = previewBuiltIns().map((item) => item.id)
      if (ids.some((id) => !catalog.includes(id))) throw new Error('Choose built-in assistants from the catalog.')
      const stored = assistants.map((assistant) => assistant.id)
      const restored = catalog.filter((id) => ids.includes(id) && !stored.includes(id))
      const removed = catalog.filter((id) => !ids.includes(id) && stored.includes(id))
      if (stored.length + restored.length - removed.length < 1) throw new Error('Keep at least one assistant.')
      for (const id of restored) {
        const item = previewBuiltIn(id)!
        const used = new Set(assistants.map((entry) => entry.name.normalize('NFKC').trim().toLowerCase()))
        let name = item.name
        for (let suffix = 2; used.has(name.normalize('NFKC').trim().toLowerCase()); suffix++)
          name = `${item.name.slice(0, 80 - ` (${suffix})`.length)} (${suffix})`
        assistants.push({ ...item, name })
      }
      for (const id of removed)
        assistants.splice(
          assistants.findIndex((assistant) => assistant.id === id),
          1,
        )
      if (!assistants.some((assistant) => assistant.id === settings.assistantId))
        settings.assistantId = fallbackAssistantId(assistants)
      settings.assistantsChosen = true
      emit()
      return { restored, removed }
    },
  }
  return api
}
