import type { GenerationApi } from '../types/generation'
import type { MockContext } from './state'
import { wait } from './simulated-delay'

// Suggested follow-up questions for a saved answer, and a sample translation of a transcript line. Neither touches
// the streamed chat pipeline.
export function generationFollowUpsApi(ctx: MockContext) {
  const { jobs, requireSession } = ctx
  const api: Pick<GenerationApi, 'followUps' | 'translateEntry'> = {
    followUps: async (input) => {
      if (jobs.has(input.requestId)) throw new Error('Request ID already in use.')
      const source = () =>
        input.historical
          ? requireSession(input.sessionId).entries.find(
              (entry) => entry.id === input.entryId && entry.kind === 'assistant',
            )
          : requireSession(input.sessionId).entries.findLast((entry) => entry.kind === 'assistant')
      const answer = source()
      if (!answer || answer.id !== input.entryId || answer.content.trim().length < 50)
        throw new Error('Suggested questions need a saved assistant answer with at least 50 characters.')
      const job = { cancelled: false }
      jobs.set(input.requestId, job)
      try {
        await wait(350)
        if (job.cancelled) throw new DOMException('Request cancelled.', 'AbortError')
        if (source()?.id !== input.entryId || source()?.content !== answer.content)
          throw new Error('The answer changed. Generate suggestions again.')
        return {
          entryId: input.entryId,
          suggestions: [
            { text: 'Explain the trade-offs', prompt: 'Explain the trade-offs in your last answer.' },
            { text: 'Plan the next step', prompt: 'What is the next practical step based on your last answer?' },
            { text: 'Check the assumptions', prompt: 'Which assumptions in your last answer should we verify?' },
          ],
        }
      } finally {
        jobs.delete(input.requestId)
      }
    },
    translateEntry: async (input) => {
      const session = requireSession(input.sessionId)
      const entry = session.entries.find((item) => item.id === input.entryId)
      if (!entry || entry.kind !== 'transcript' || entry.speaker !== 'THEY' || !entry.content.trim())
        throw new Error('Choose a nonempty participant transcript message.')
      if (!input.language.trim()) throw new Error('Choose a translation language.')
      return {
        entryId: entry.id,
        language: input.language.trim(),
        text: `Preview translation into ${input.language.trim()}: ${entry.content}`,
      }
    },
  }
  return api
}
