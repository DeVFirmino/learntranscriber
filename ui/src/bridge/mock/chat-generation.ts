import type { GenerationApi, GenerationOutcome, GenerationFailureCode } from '../types/generation'
import type { MockContext } from './state'
import { text } from './input-validation'

// The streamed chat answer and its cancellation. No model is contacted.
export function chatGenerationApi(ctx: MockContext) {
  const { overlayAnswers, overlayFinished, jobs, settings, emit, requireSession, addEntry, stream } = ctx
  const api: Pick<GenerationApi, 'generate' | 'cancel'> = {
    generate: async (input) => {
      const session = requireSession(input.sessionId)
      const mode = input.mode || 'chat'
      if (mode === 'translation' && !settings.translationLanguage.trim())
        throw new Error('Translation is off. Choose a language in Settings.')
      if (!['chat', 'summary', 'practice', 'summaryRewrite', 'translation', 'insight', 'screenInsight'].includes(mode))
        throw new Error('Invalid generation mode.')
      const summaryConversation =
        mode === 'summary' &&
        session.entries.some(
          (entry) => ['user', 'assistant', 'transcript'].includes(entry.kind) && entry.content.trim(),
        )
      if (
        !['chat', 'screenInsight'].includes(mode) &&
        !summaryConversation &&
        !session.entries.some((entry) => entry.kind === 'transcript')
      )
        throw new Error('Add or record a transcript before generating session insights.')
      if (jobs.has(input.requestId)) throw new Error('Request ID already in use.')
      if (input.image !== undefined && input.images !== undefined)
        throw new Error('Send either images or a legacy image, not both.')
      const images = input.images ?? (input.image ? [input.image] : [])
      if (
        !Array.isArray(images) ||
        images.length > 4 ||
        images.some(
          (value) =>
            typeof value !== 'string' ||
            value.length > 10_666_700 ||
            !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value),
        ) ||
        images.reduce((total, value) => total + Math.floor(((value.length - 22) * 3) / 4), 0) > 24_000_000
      )
        throw new Error('Attach up to four valid PNG screenshots.')
      let outcome: GenerationOutcome = 'success'
      let errorCode: GenerationFailureCode | undefined
      const job = { cancelled: false }
      jobs.set(input.requestId, job)
      if (mode !== 'summaryRewrite')
        ctx.overlayDeltas.emit({ requestId: input.requestId, sessionId: session.id, mode, delta: '' })
      try {
        if (mode === 'chat')
          addEntry(session.id, 'user', text(input.question, 20000), '', { mode, requestId: input.requestId })
        let answer = 'Preview answer. No model was contacted. '
        if (mode === 'summaryRewrite')
          answer = `Rewritten preview: ${input.draft?.trim() || 'This session covers the recorded conversation.'}`
        else if (mode === 'summary')
          answer +=
            'Overview: this sample session is about a study decision. Decisions: write the base case first. Open questions: none in the preview. Next steps: resume the session only if you mean to.'
        else if (mode === 'practice')
          answer +=
            '\n\n1. What is a base case?\n2. Why must the recursive call shrink the input?\n3. Which list would you test first, and why?\n\n## Answers\n\n1. The input the function answers without calling itself.\n2. So the calls reach the base case and stop.\n3. The empty list: it checks the base case before any recursion.'
        else if (mode === 'translation')
          answer += `ME: Sample translation into ${settings.translationLanguage}. The original meaning is preserved. THEY: This is not a live translation.`
        else if (mode === 'insight')
          answer += 'One next step: confirm the base case with an empty list before trusting the recursive call.'
        else if (mode === 'screenInsight')
          answer += 'The attached preview text is sample context, not a captured screen.'
        else
          answer += input.context
            ? 'Your reviewed text was included only as untrusted context.'
            : 'Ask again after adding a transcript if you want a grounded note.'
        await stream(input.requestId, answer, { mode, sessionId: session.id })
        if (mode === 'summaryRewrite') return answer
        if (mode === 'summary') session.summary = answer
        else if (mode === 'translation') session.translation = answer
        else addEntry(session.id, 'assistant', answer, '', { mode, requestId: input.requestId })
        overlayAnswers.emit({ text: answer, sessionId: session.id, mode, requestId: input.requestId })
        emit()
        return answer
      } catch (error) {
        outcome = job.cancelled ? 'cancelled' : 'error'
        if (outcome === 'error') errorCode = 'generationFailed'
        throw error
      } finally {
        jobs.delete(input.requestId)
        if (mode !== 'summaryRewrite')
          overlayFinished.emit({
            requestId: input.requestId,
            sessionId: session.id,
            mode,
            outcome,
            ...(errorCode ? { errorCode } : {}),
          })
      }
    },
    cancel: async (id) => {
      const job = jobs.get(id)
      if (job) job.cancelled = true
      return true
    },
  }
  return api
}
