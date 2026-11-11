import type { GenerationApi } from '../types/generation'
import type { MockContext } from './state'
import { chatGenerationApi } from './chat-generation'
import { generationFollowUpsApi } from './generation-followups'

// Response actions and event subscriptions for the chat feature. The streamed answer and the follow-up helpers are
// composed in from their own modules.
export function generationApi(ctx: MockContext) {
  const { deltas, overlayDeltas, overlayAnswers, overlayFinished } = ctx
  const api: GenerationApi = {
    copyResponseCode: async (value) => navigator.clipboard.writeText(value),
    openResponseLink: async (url) => {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
        throw new Error('Unsupported response link.')
      window.open(parsed.href, '_blank', 'noopener,noreferrer')
    },
    onDelta: deltas.subscribe,
    onOverlayDelta: overlayDeltas.subscribe,
    onOverlayAnswer: overlayAnswers.subscribe,
    onOverlayFinished: overlayFinished.subscribe,
    ...generationFollowUpsApi(ctx),
    ...chatGenerationApi(ctx),
  }
  return api
}
