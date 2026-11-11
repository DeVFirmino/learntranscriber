import type { SessionDetail } from '@/bridge/types/sessions'

export interface FinishSessionPorts {
  stopAudio(): Promise<void>
  failedSegments(): number
  cancelGeneration(): Promise<void>
  endSession(id: string): Promise<SessionDetail>
  generateSummary(id: string): Promise<void>
  session(id: string): Promise<SessionDetail>
  pendingAudioMessage: string
}

// Final transcript flush precedes the persisted end. Summary generation is optional and happens afterwards,
// so a provider failure leaves an ended, retryable session rather than silently losing the captured source.
export async function finishSession(id: string, summary: boolean, ports: FinishSessionPorts) {
  await ports.stopAudio()
  if (ports.failedSegments()) throw new Error(ports.pendingAudioMessage)
  await ports.cancelGeneration()
  const ended = await ports.endSession(id)
  if (summary && !ended.summary.trim()) {
    await ports.generateSummary(id)
    return ports.session(id)
  }
  return ended
}
