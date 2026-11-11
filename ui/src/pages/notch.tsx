import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useWorkspace, useWorkspaceLive } from '@/workspace'
import { AssistantResponse } from '@/components/assistant-response'
import { NotchSettings } from '@/components/notch-settings'
import { offersFollowUps } from '@/features/notch-follow-ups'
import { NotchFollowUpList } from '@/features/notch/notch-follow-up-list'
import { NotchFooter } from '@/features/notch/notch-footer'
import { NotchHeader } from '@/features/notch/notch-header'
import { useDisplayAck } from '@/features/notch/use-display-ack'
import { useNotchInsights } from '@/features/notch/use-notch-insights'
import { useNotchPointer } from '@/features/notch/use-notch-pointer'
import { useT } from '@/use-t'

export function Notch() {
  const ws = useWorkspace()
  const { overlayAnswer, overlayStreaming, overlayResponseId } = useWorkspaceLive()
  const { t } = useT()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const insights = useNotchInsights(t('notch.suggestionsFailed'))
  const pointer = useNotchPointer(() => setSettingsOpen(false))
  const { history, position, insight, move, scrollPositions } = insights
  const fontScale = ws.state?.settings.unifiedModalFontScale ?? 1
  useEffect(
    () =>
      ws.api.onAction((action) => {
        if (action === 'previousInsight') move(-1)
        if (action === 'nextInsight') move(1)
        // Scrolling reaches the Notch when no session panel is shown.
        if (action === 'scrollUp' || action === 'scrollDown')
          contentRef.current?.scrollBy({ top: action === 'scrollUp' ? -150 : 150 })
      }),
    [ws.api, move],
  )
  const insightId = insight?.id
  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = insightId ? scrollPositions.current.get(insightId) || 0 : 0
  }, [insightId, settingsOpen, scrollPositions])
  useDisplayAck({
    contentRef,
    displayAckId: insights.displayAckId,
    setDisplayAckId: insights.setDisplayAckId,
    settingsOpen,
    position,
    streaming: overlayStreaming,
  })

  if (!ws.state) return null
  if (!ws.state.notch.expanded) return null
  // An older insight shows as saved; the latest shows the answer arriving now, or the last one, or a hint.
  const latest = overlayStreaming ? overlayAnswer : insight?.text || overlayAnswer
  const content = position >= 0 ? insight?.text || '' : latest || t('notch.empty')
  return (
    <section
      data-notch
      className="relative flex h-screen flex-col rounded-2xl border bg-surface p-4 text-foreground"
      aria-label={t('notch.region')}
      onMouseEnter={pointer.enter}
      onMouseLeave={pointer.leave}
    >
      <NotchHeader pointer={pointer} settingsOpen={settingsOpen} onSettingsOpen={setSettingsOpen} />
      {settingsOpen ? (
        <div className="min-h-0 flex-1 overflow-auto pr-1">
          <NotchSettings />
        </div>
      ) : (
        <>
          <div
            ref={contentRef}
            data-display-ack-id={position < 0 && !overlayStreaming ? insights.displayAckId || '' : ''}
            className="min-h-0 flex-1 overflow-auto"
            onScroll={(event) => {
              if (insight) scrollPositions.current.set(insight.id, event.currentTarget.scrollTop)
            }}
          >
            <AssistantResponse
              responseId={insight?.id || overlayResponseId}
              content={content}
              streaming={position < 0 && overlayStreaming}
              actions={ws.api}
              fontScale={fontScale}
            />
          </div>
          {insights.followUpsEnabled && offersFollowUps(insight) ? (
            <NotchFollowUpList
              state={insights.insightState}
              onGenerate={() => void insights.generateFollowUps()}
              onCancel={insights.cancelFollowUps}
              onAsk={(prompt) => {
                insights.showLatest()
                void ws.act(() => ws.runGeneration('chat', prompt))
              }}
            />
          ) : null}
          <NotchFooter count={history.length} position={position} onMove={move} />
        </>
      )}
      <button
        type="button"
        aria-label={t('notch.resize')}
        title={t('notch.resize')}
        className="absolute bottom-1 right-1 flex size-6 cursor-nwse-resize touch-none items-center justify-center rounded-md hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-primary"
        onPointerDown={pointer.beginResize}
        onPointerMove={pointer.updateResize}
        onPointerUp={pointer.endResize}
        onPointerCancel={pointer.endResize}
      >
        <span aria-hidden="true" className="block size-3 border-b-2 border-r-2 border-foreground/50" />
      </button>
    </section>
  )
}
