import { useEffect, useState, type ReactNode } from 'react'
import { createWorkspace } from '@/bridge'
import { flushBeforeQuit } from '@/features/workspace/quit-flush'
import { showListeningHint } from '@/features/workspace/listening-hint'
import { errorReporter } from '@/features/workspace/error-reporter'
import { showIntegrationFeedback } from '@/features/workspace/integration-feedback'
import { setErrorReport, setRestartAction } from '@/features/workspace/error-toast'
import { useCaptureFeedback } from '@/features/workspace/use-capture-feedback'
import { useGeneration } from '@/features/workspace/use-generation'
import { useLiveInsights } from '@/features/workspace/use-live-insights'
import { useOverlayStream } from '@/features/workspace/use-overlay-stream'
import { usePendingContext } from '@/features/workspace/use-pending-context'
import { useShortcutActions } from '@/features/workspace/use-shortcut-actions'
import { useWorkspaceActions } from '@/features/workspace/use-workspace-actions'
import { useWorkspaceAudio } from '@/features/workspace/use-workspace-audio'
import { useWorkspaceEvents } from '@/features/workspace/use-workspace-events'
import { useWorkspaceSessions } from '@/features/workspace/use-workspace-sessions'
import { useWorkspaceValues } from '@/features/workspace/use-workspace-values'
import { readOverlay } from '@/features/workspace/window-location'
import { useWindowLocation } from '@/features/workspace/use-window-location'
import { useWorkspaceState } from '@/features/workspace/use-workspace-state'
import { LiveWorkspaceContext, WorkspaceContext, type DialogRequest } from '@/workspace'

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [bridge] = useState(createWorkspace)
  const api = bridge.api
  // A Keychain read macOS refused only recovers after a restart, which its error notification offers. Every error
  // shown is logged, and one shown in the workspace while the user looks elsewhere reaches the floating bar too.
  useEffect(() => {
    setRestartAction(() => void api.relaunchApp())
    setErrorReport((message, notice) => {
      const forward = !readOverlay() && !document.hasFocus()
      void api.reportError({ message, forward, notice }).catch(() => undefined)
      return forward
    })
  }, [api])
  const captureState = useCaptureFeedback(api)
  const errors = errorReporter(api)
  const reportError = errors.report
  const workspace = useWorkspaceState()
  const { state, setState, read: readState } = workspace
  const where = useWindowLocation()
  const { overlay, overlayRef } = where
  const [sessionTab, setSessionTab] = useState<'transcript' | 'summary' | 'translation'>('transcript')
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<DialogRequest>(null)
  const recorder = useWorkspaceAudio(api, {
    overlay,
    echoReductionEnabled: state?.settings.echoReductionEnabled === true,
    sessionTimer: state?.settings.sessionTimer,
  })
  const audio = recorder.audio
  const pending = usePendingContext({ overlay: () => overlayRef.current, state: readState })
  const shown = useWorkspaceSessions(api, {
    state: readState,
    setState,
    clearImages: () => pending.replaceImages([]),
  })
  const answering = useGeneration(api, {
    state: readState,
    overlay: () => overlayRef.current,
    selectedId: () => shown.sessions.selectedId,
    shownSessionId: () => shown.sessionRef.current?.id,
    pending,
    refresh: () => shown.sessions.refresh(),
    ensureSession: () => shown.actions.ensureSession(),
  })
  const overlayAnswer = useOverlayStream(api, () => readState()?.activeSessionId)
  const insights = useLiveInsights(api, {
    overlay,
    state: readState,
    recording: () => recorder.recording.recording(),
    paused: () => audio.paused,
    generating: () => Boolean(answering.generation.requestId),
    generate: (question, transcript, trigger) =>
      answering.generation.run('insight', question, undefined, transcript, trigger),
    failed: reportError,
  })
  const toggleListening = () => recorder.toggle(shown.actions.ensureSession)
  const runAction = useShortcutActions({
    api,
    notice: (permission) => showListeningHint(api, permission),
    overlay: () => overlayRef.current,
    captureScreen: answering.actions.captureScreen,
    quickScreenshot: () => readState()?.settings.quickScreenshot === true,
    recording: () => audio.recording,
    togglePause: () => audio.togglePause(),
    muteMicrophone: () => audio.muteMicrophone(),
    toggleListening,
    insight: (transcript) => answering.generation.run('insight', undefined, undefined, transcript, 'manual'),
    generating: () => Boolean(answering.generation.requestId),
    captions: () => insights.captionsRef.current,
    openQuestion: api.openQuestion,
  })

  useWorkspaceEvents(api, {
    ...where.events,
    ...workspace.events,
    caption: insights.caption,
    prepareQuit: () => void flushBeforeQuit(audio, api),
    action: (action) => void runAction(action).catch(reportError),
    change: (value) => {
      setState(value)
      if (!value.activeSessionId && audio.recording) void audio.stop().catch(reportError)
      pending.followSession(value.activeSessionId)
      if (overlayRef.current) return
      if (where.routeRef.current === 'session') void shown.actions.refreshSession().catch(reportError)
      // Whatever page the workspace shows, live insights follow the listening session.
      if (recorder.recording.recording() && value.activeSessionId)
        void insights.loadListening(value.activeSessionId).catch(reportError)
    },
    delta: answering.delta,
    ...overlayAnswer.events,
    selection: pending.selection,
    integrationError: (feedback) => showIntegrationFeedback(api, feedback),
    loaded: async (value, alive) => {
      setState(value)
      if (readOverlay() && value.activeSessionId) await overlayAnswer.showLatest(value.activeSessionId, alive)
    },
    dispose: () => void audio.stop().catch(reportError),
  })

  const actions = useWorkspaceActions({
    bridge,
    errors,
    go: where.go,
    setQuery,
    ...recorder.actions,
    ...pending.actions,
    ...shown.actions,
    ...answering.actions,
    toggleListening,
    setSessionTab,
    setDialog,
  })
  const { value, live } = useWorkspaceValues(
    actions,
    {
      state,
      loadError: workspace.loadError,
      route: where.route,
      overlay,
      windowRole: where.windowRole,
      recordingReminder: recorder.recordingReminder,
      session: shown.session,
      sessionTab,
      query,
      captureState,
      pendingImages: pending.pendingImages,
      pendingText: pending.pendingText,
      requestId: answering.requestId,
      audioRev: recorder.audioRev,
      dialog,
    },
    {
      liveCaptions: insights.liveCaptions,
      answer: answering.answer,
      pendingQuestion: answering.pendingQuestion,
      overlayStream: overlayAnswer.overlayStream,
    },
  )

  return (
    <WorkspaceContext.Provider value={value}>
      <LiveWorkspaceContext.Provider value={live}>{children}</LiveWorkspaceContext.Provider>
    </WorkspaceContext.Provider>
  )
}
