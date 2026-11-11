import type { Entry } from '@/bridge/types/sessions'
import type { OverlayStream } from '../workspace/stream-state'
import { streamStatus } from '../workspace/stream-state'
import { conversationEntries, generatedRole } from './conversation-entries'
import { isSilentAnswer } from './silent-answer'

export function answerPresentation({
  entries,
  sessionId,
  stream,
  requestId,
  pendingQuestion,
}: {
  entries: Entry[]
  sessionId?: string
  stream: OverlayStream
  requestId: string | null
  pendingQuestion: string
}) {
  const conversation = sessionId ? conversationEntries(entries, sessionId) : []
  const latestAnswer = conversation.findLast((item) => item.entry.kind === 'assistant')?.entry
  const current =
    (!stream.sessionId || stream.sessionId === sessionId) && (!requestId || stream.responseId === requestId)
  const savedStream = conversation.some(
    ({ entry }) => entry.kind === 'assistant' && entry.request_id && entry.request_id === stream.responseId,
  )
  const streaming = current && stream.streaming && !isSilentAnswer(stream.answer) && !savedStream
  const completion = current && !savedStream ? streamStatus(stream.outcome, stream.errorCode) : null
  const pending = !completion && Boolean(requestId || (current && stream.streaming))
  const pendingSaved =
    conversation.some(({ entry, role }) => role === 'user' && entry.request_id === requestId && Boolean(requestId)) ||
    (conversation.at(-1)?.role === 'user' && conversation.at(-1)?.entry.content === pendingQuestion)
  return {
    conversation,
    latestAnswer,
    streaming,
    completion,
    streamRole: generatedRole(stream.mode),
    showStream: (streaming || Boolean(completion)) && !isSilentAnswer(stream.answer),
    showCompletionOnly: Boolean(completion) && isSilentAnswer(stream.answer),
    showPendingQuestion: pending && Boolean(pendingQuestion) && !pendingSaved,
    showProcessing: pending && !streaming,
    showEmpty: !conversation.length && !pending && !completion,
    showFollowUps: Boolean(sessionId && latestAnswer && !pending && !completion),
  }
}
