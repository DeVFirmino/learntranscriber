import type { AssistantsApi } from '../types/assistants'
import type { MockContext } from './state'
import { wait } from './simulated-delay'
import { assistantLibraryApi } from './assistant-library'
import { assistantSharingApi } from './assistant-sharing'

// The simulated AI builder. The library and the share format are composed in from their own modules; nothing leaves
// the browser.
export function assistantsApi(ctx: MockContext) {
  const { jobs, assistants } = ctx
  const library = assistantLibraryApi(ctx)
  const api: AssistantsApi = {
    ...library,
    ...assistantSharingApi(ctx),
    applyBuilderAction: async ({ proposal, draft }) => {
      if (proposal.tool !== 'save_assistant_draft' || !draft) throw new Error('Unsupported builder action.')
      const id = await library.saveAssistant({ name: draft.name, prompt: draft.systemPrompt, category: draft.category })
      return { tool: proposal.tool, id, name: draft.name }
    },
    buildAssistant: async (input) => {
      const job = { cancelled: false }
      jobs.set(input.requestId, job)
      try {
        await wait(350)
        if (job.cancelled) throw new DOMException('Request cancelled.', 'AbortError')
        return {
          message: 'Simulated draft ready for review. No model was contacted and nothing was saved.',
          results: [
            {
              tool: 'search_assistant_library',
              assistants: assistants
                .slice(0, 3)
                .map((item) => ({ id: item.id, name: item.name, category: item.category || 'Uncategorized' })),
            },
          ],
          proposals: [
            { tool: 'save_assistant_draft', args: { reason: 'Preview proposal' }, token: crypto.randomUUID() },
          ],
          finished: false,
          draft: {
            name: 'Interview companion',
            category: 'Career',
            systemPrompt: `Help the user prepare for a technical interview. Ask one question at a time and give concise, evidence-based feedback.\n\nRequested behavior: ${input.question.trim()}`,
            realtimePrompt: 'Offer one brief observation when useful.',
            followUpPrompt: 'Suggest a useful next practice question.',
            emailPrompt: 'Summarize the topics practiced.',
            requireCertainty: true,
            ...input.draft,
          },
        }
      } finally {
        jobs.delete(input.requestId)
      }
    },
  }
  return api
}
