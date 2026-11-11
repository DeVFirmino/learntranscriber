import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkspaceApi } from '@/bridge/types/api'
import type { PublicState } from '@/bridge/types/state'
import { HesitationMonitor } from './hesitation-monitor'
import { InsightLoop, type ListeningSession, type LiveTrigger } from './insight-loop'
import { InsightScheduler } from './insight-scheduler'
import { useLatest } from './use-latest'
import type { WorkspaceEvents } from './use-workspace-events'

// Live insights: what each speaker is saying now, the listening session's saved lines, refreshed on every change, and
// the loop that asks for an insight when the conversation calls for one. Overlay windows run no loop.
export function useLiveInsights(
  api: WorkspaceApi,
  hooks: {
    overlay: boolean
    state: () => PublicState | null
    recording: () => boolean
    paused: () => boolean
    generating: () => boolean
    generate: (question: string | undefined, transcript: string, trigger: LiveTrigger) => Promise<string>
    failed: (error: unknown) => void
  },
) {
  const [liveCaptions, setLiveCaptions] = useState<Record<string, string>>({})
  const captionsRef = useLatest(liveCaptions)
  const listeningRef = useRef<ListeningSession | null>(null)
  // The loop is created once per window, so it reads the latest callbacks rather than the first render's.
  const latest = useLatest(hooks)
  const overlay = hooks.overlay
  const loadListening = useCallback(
    (sessionId: string) =>
      api.session(sessionId).then((detail) => {
        listeningRef.current = {
          sessionId,
          lines: detail.entries
            .filter((entry) => entry.kind === 'transcript')
            .map((entry) => ({
              speaker: entry.speaker,
              text: entry.content,
              at: Date.parse(entry.created_at) || Date.now(),
            })),
        }
      }),
    [api],
  )
  useEffect(() => {
    if (overlay) return
    const loop = new InsightLoop({
      scheduler: new InsightScheduler(),
      hesitation: new HesitationMonitor({
        newId: () => crypto.randomUUID(),
        evaluate: (input) => api.generate(input),
        cancel: (id) => api.cancel(id),
      }),
      state: () => latest.current.state(),
      recording: () => latest.current.recording(),
      paused: () => latest.current.paused(),
      listening: () => listeningRef.current,
      load: loadListening,
      captions: () => captionsRef.current,
      generating: () => latest.current.generating(),
      generate: (question, transcript, trigger) => latest.current.generate(question, transcript, trigger),
      failed: (error) => latest.current.failed(error),
      now: () => Date.now(),
      every: (ms, run) => {
        const timer = window.setInterval(run, ms)
        return () => window.clearInterval(timer)
      },
    })
    return loop.start()
  }, [api, overlay, latest, captionsRef, loadListening])
  const caption: WorkspaceEvents['caption'] = (value) => {
    if (value.sessionId !== hooks.state()?.activeSessionId) return
    setLiveCaptions((current) => ({ ...current, [value.speaker]: value.final || value.error ? '' : value.text }))
  }
  return { liveCaptions, captionsRef, loadListening, caption }
}
