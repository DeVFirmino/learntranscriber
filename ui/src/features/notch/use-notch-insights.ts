import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useWorkspace } from '@/workspace'
import { appendNotchInsight, emptyNotchHistory, moveNotchInsight } from '@/notch-history'
import { NotchFollowUps, type FollowUpsByInsight } from '@/features/notch-follow-ups'

// The live session's insights in the Notch: the saved answers it starts from, each new one the overlay publishes,
// moving through them, the scroll position of each, and their follow-up suggestions. A new session starts over.
export function useNotchInsights(failure: string) {
  const ws = useWorkspace()
  const [insights, setInsights] = useState(emptyNotchHistory)
  const [displayAckId, setDisplayAckId] = useState<string | null>(null)
  const [followUps, setFollowUps] = useState<FollowUpsByInsight>({})
  const scrollPositions = useRef(new Map<string, number>())
  const [followUpRequests] = useState(
    () =>
      new NotchFollowUps({
        followUps: (input) => ws.api.followUps(input),
        cancel: (requestId) => ws.api.cancel(requestId),
        update: setFollowUps,
        newId: () => crypto.randomUUID(),
      }),
  )
  const { items: history, position } = insights
  const sessionId = ws.state?.activeSessionId
  const insight = position < 0 ? history.at(-1) : history[position]
  const followUpsEnabled = ws.state?.settings.notchFollowUps !== false
  // A new session starts over, and turning suggestions off drops the ones shown, in the same render.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [shownSession, setShownSession] = useState(sessionId)
  if (shownSession !== sessionId) {
    setShownSession(sessionId)
    setInsights(emptyNotchHistory)
    setDisplayAckId(null)
    setFollowUps({})
  }
  const [suggestionsOn, setSuggestionsOn] = useState(followUpsEnabled)
  if (suggestionsOn !== followUpsEnabled) {
    setSuggestionsOn(followUpsEnabled)
    if (!followUpsEnabled) setFollowUps({})
  }
  useLayoutEffect(() => {
    followUpRequests.setSession(sessionId)
  }, [followUpRequests, sessionId])

  useEffect(() => {
    let alive = true
    scrollPositions.current.clear()
    if (sessionId)
      void ws.api
        .session(sessionId)
        .then((session) => {
          if (alive)
            setInsights((current) =>
              current.items.length
                ? current
                : {
                    items: session.entries
                      .filter((entry) => entry.kind === 'assistant')
                      .slice(-20)
                      .map((entry) => ({ id: entry.id, entryId: entry.id, text: entry.content })),
                    position: -1,
                  },
            )
        })
        .catch(() => {})
    const stop = ws.api.onOverlayAnswer((value) => {
      if (value.sessionId !== sessionId) return
      setInsights((current) =>
        appendNotchInsight(current, {
          id: value.entryId || value.requestId || crypto.randomUUID(),
          entryId: value.entryId,
          text: value.text,
        }),
      )
      setDisplayAckId(
        typeof value.displayAckId === 'string' && value.displayAckId.trim() && value.displayAckId.length <= 200
          ? value.displayAckId
          : null,
      )
    })
    return () => {
      alive = false
      stop()
      followUpRequests.cancelAll()
    }
  }, [ws.api, sessionId, followUpRequests])

  useEffect(() => {
    followUpRequests.retain(new Set(history.map((item) => item.id)))
  }, [history, followUpRequests])

  useEffect(() => {
    if (!followUpsEnabled) followUpRequests.cancelAll()
  }, [followUpsEnabled, followUpRequests])

  const move = useCallback((direction: number) => setInsights((current) => moveNotchInsight(current, direction)), [])
  return {
    history,
    position,
    insight,
    insightState: insight ? followUps[insight.id] : undefined,
    followUpsEnabled,
    scrollPositions,
    displayAckId,
    setDisplayAckId,
    move,
    // Following a suggestion returns the Notch to the latest insight, where its answer arrives.
    showLatest: () => setInsights((current) => ({ ...current, position: -1 })),
    generateFollowUps: () =>
      followUpRequests.generate({
        sessionId,
        insight,
        enabled: followUpsEnabled,
        busy: Boolean(ws.requestId),
        failure,
      }),
    cancelFollowUps: () => {
      if (insight) followUpRequests.cancel(insight.id)
    },
  }
}
