import type { MemoryApi } from '../types/memory'
import type { MockContext } from './state'
import { wait } from './simulated-delay'

export function memoryApi(ctx: MockContext) {
  const { jobs } = ctx
  const api: MemoryApi = {
    transcribeMemory: async (input) => {
      if (input.mime !== 'audio/wav' || !(input.bytes instanceof ArrayBuffer) || input.bytes.byteLength > 2000000)
        throw new Error('Dictation requires a WAV segment under 2 MB.')
      if (jobs.has(input.requestId)) throw new Error('Request ID already in use.')
      const job = { cancelled: false }
      jobs.set(input.requestId, job)
      try {
        await wait(120)
        if (job.cancelled) throw new DOMException('Dictation cancelled.', 'AbortError')
        return 'What did the preview session decide?'
      } finally {
        jobs.delete(input.requestId)
      }
    },
  }
  return api
}
