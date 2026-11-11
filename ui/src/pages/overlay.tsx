import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useWorkspace, useWorkspaceLive } from '@/workspace'
import { OnboardingSurface } from '@/features/onboarding/surface'
import { shouldPresentOnboarding } from '@/features/onboarding/progress'
import { OverlayBar } from '@/features/overlay/overlay-bar'
import { OverlayPanel } from '@/features/overlay/overlay-panel'
import type { View } from '@/features/overlay/panel-view'
import { useActiveSession } from '@/features/overlay/use-active-session'
import { isSilentAnswer } from '@/features/overlay/silent-answer'
import { CompactComposer } from '@/features/overlay/compact-composer'
import { questionPresentation } from '@/features/overlay/question-presentation'
import { useT } from '@/use-t'
import '@/features/overlay/floating-tokens.css'
import '@/features/overlay/floating-surfaces.css'
import '@/features/overlay/floating-layout.css'
import '@/features/overlay/floating-icons.css'

// The floating assistant: an assistant pill and a compact bar at the
// bottom centre of the screen, and, while listening or when expanded, a session panel above them with the live
// transcript, the session's answers and its summary. Questions are asked from the panel's Session tab, or, while
// the panel is collapsed during a session, from the bar's own prompt row above its live transcript preview.
export function Overlay() {
  const ws = useWorkspace()
  const { t } = useT()
  const [question, setQuestion] = useState('')
  const [view, setView] = useState<View>('session')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [asking, setAsking] = useState(false)
  const barOnly = new URLSearchParams(window.location.search).get('surface') === 'bar'
  const questionRef = useRef<HTMLTextAreaElement>(null)
  const session = useActiveSession()
  const { overlayAnswer, overlayStreaming, overlayResponseId } = useWorkspaceLive()

  // Each new answer, as its first words arrive and once it is saved, brings the Session tab forward
  // on every new turn, so a collapsed or Transcript-tab panel opens straight onto it.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const arriving = overlayStreaming && !isSilentAnswer(overlayAnswer) ? overlayResponseId : null
  const answers =
    session?.entries.filter((entry) => entry.kind === 'assistant' && !isSilentAnswer(entry.content)).length ?? 0
  const expanded = Boolean(ws.state?.overlay.expanded)
  const [seen, setSeen] = useState({ arriving, answers, expanded })
  if (seen.arriving !== arriving || seen.answers !== answers || seen.expanded !== expanded) {
    setSeen({ arriving, answers, expanded })
    const answerArrived = Boolean(arriving && arriving !== seen.arriving) || answers > seen.answers
    if (answerArrived) setView('session')
    setAsking(questionPresentation({ asking, expanded, answerArrived }))
  }

  // Ask (the Notch button or its shortcut) opens the Session tab with the question box focused.
  useEffect(() => {
    const compose = () => {
      setView('session')
      setAsking(true)
      window.setTimeout(() => questionRef.current?.focus(), 50)
    }
    const onAsk = () => {
      const input = questionRef.current
      const send = input?.form?.querySelector<HTMLButtonElement>('button[type="submit"]')
      if (
        input &&
        (input.value.trim() || ws.pendingImages.length) &&
        !ws.requestId &&
        document.activeElement === input &&
        send &&
        !send.disabled
      ) {
        input.form?.requestSubmit()
      } else compose()
    }
    const offDraft = ws.api.onQuestionDraft((draft) => {
      setQuestion(draft)
      window.dispatchEvent(new CustomEvent('floating-compose'))
    })
    const response = () => {
      setView('session')
      setAsking(false)
    }
    window.addEventListener('floating-response', response)
    window.addEventListener('floating-ask', onAsk)
    window.addEventListener('floating-compose', compose)
    return () => {
      offDraft()
      window.removeEventListener('floating-response', response)
      window.removeEventListener('floating-ask', onAsk)
      window.removeEventListener('floating-compose', compose)
    }
  }, [ws.api, ws.pendingImages.length, ws.requestId])

  if (!ws.state) return null
  if (!barOnly && shouldPresentOnboarding(ws.state)) return <OnboardingSurface floating />
  return (
    <div
      data-floating
      style={{ '--floating-frame-opacity': ws.state.settings.overlayOpacity } as CSSProperties}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented || !expanded || barOnly) return
        event.preventDefault()
        void ws.act(async () => {
          await ws.api.expandOverlay(false)
        })
      }}
      className="flex h-screen min-w-0 flex-col justify-end gap-2 overflow-hidden p-2 text-foreground"
      aria-label={t('overlay.actions')}
    >
      {expanded && !barOnly && asking ? (
        <section
          data-compact-question
          className="w-full max-w-[30rem] min-h-0 self-center rounded-2xl"
          aria-label={t('overlay.followUp')}
        >
          <CompactComposer
            compact
            question={question}
            onQuestion={setQuestion}
            questionRef={questionRef}
            onClose={() =>
              void ws.act(async () => {
                await ws.api.expandOverlay(false)
              })
            }
          />
        </section>
      ) : null}
      {expanded && !barOnly && !asking ? (
        <OverlayPanel
          view={view}
          onView={setView}
          settingsOpen={settingsOpen}
          onSettingsOpen={setSettingsOpen}
          session={session}
          question={question}
          onQuestion={setQuestion}
          questionRef={questionRef}
        />
      ) : null}
      {barOnly ? <OverlayBar session={session} /> : null}
    </div>
  )
}
