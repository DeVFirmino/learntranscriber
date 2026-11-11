import type { MockEvents } from './events'
import { wait } from './simulated-delay'

// Streams a sample answer word by word, as a provider would, to the chat and the overlay. A cancelled request stops
// at the next word.
export function createWordStream(jobs: Map<string, { cancelled: boolean }>, events: MockEvents) {
  return async function stream(
    requestId: string,
    value: string,
    generation: { mode?: string; sessionId?: string } = {},
  ) {
    const job = jobs.get(requestId)
    for (const part of value.split(/(\s+)/)) {
      if (!job || job.cancelled) throw new DOMException('Request cancelled or timed out.', 'AbortError')
      await wait(16)
      if (job.cancelled) throw new DOMException('Request cancelled or timed out.', 'AbortError')
      const payload = { requestId, delta: part }
      events.deltas.emit(payload)
      if (generation.mode !== 'summaryRewrite') events.overlayDeltas.emit({ ...payload, ...generation })
    }
  }
}
