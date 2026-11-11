import { useMemo } from 'react'
import type { OverlayStream } from './stream-state'
import type { LiveWorkspace, WorkspaceActions, WorkspaceData, WorkspaceValue } from '@/workspace'

// The two context values: the workspace's data with its actions, and what is being said and answered right now.
// Each is a new object only when one of its own fields changes.
export function useWorkspaceValues(
  actions: WorkspaceActions,
  data: WorkspaceData,
  live: { liveCaptions: Record<string, string>; answer: string; pendingQuestion: string; overlayStream: OverlayStream },
) {
  const { state, loadError, route, overlay, windowRole, recordingReminder, session, sessionTab, query } = data
  const { captureState, pendingImages, pendingText, requestId, audioRev, dialog } = data
  const value = useMemo<WorkspaceValue>(
    () => ({
      ...actions,
      state,
      loadError,
      route,
      overlay,
      windowRole,
      recordingReminder,
      session,
      sessionTab,
      query,
      captureState,
      pendingImages,
      pendingText,
      requestId,
      audioRev,
      dialog,
    }),
    [
      actions,
      state,
      loadError,
      route,
      overlay,
      windowRole,
      recordingReminder,
      session,
      sessionTab,
      query,
      captureState,
      pendingImages,
      pendingText,
      requestId,
      audioRev,
      dialog,
    ],
  )
  const { liveCaptions, answer, pendingQuestion, overlayStream } = live
  const liveValue = useMemo<LiveWorkspace>(
    () => ({
      liveCaptions,
      answer,
      pendingQuestion,
      overlayAnswer: overlayStream.answer,
      overlayOutcome: overlayStream.outcome,
      overlayErrorCode: overlayStream.errorCode,
      overlaySessionId: overlayStream.sessionId,
      overlayMode: overlayStream.mode,
      overlayStreaming: overlayStream.streaming,
      overlayResponseId: overlayStream.responseId,
      overlayStartedAt: overlayStream.startedAt,
    }),
    [liveCaptions, answer, pendingQuestion, overlayStream],
  )
  return { value, live: liveValue }
}
