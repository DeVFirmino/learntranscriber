import { useEffect, useRef, useState } from 'react'
import type { SessionDetail } from '@/bridge/types/sessions'
import { BarGuide } from '@/features/onboarding/bar-guide'
import { BarPrompt } from '@/features/bar-prompt'
import { BarTranscriptPreview } from '@/features/bar-transcript-preview'
import { useWorkspace, useWorkspaceLive } from '@/workspace'
import { useT } from '@/use-t'
import { CaptureNotice } from '@/components/capture-notice'
import { AssistantPicker } from './assistant-picker'
import { BarControls } from './bar-controls'
import { ShortcutSheet } from './shortcut-sheet'
import { shortcutHints } from './shortcut-hints'
import { useShortcutSheet } from './use-shortcut-sheet'
import { BarLaunch } from './bar-launch'
import { useLaunchIntro } from './use-launch-intro'
import { shouldPresentOnboarding } from '../onboarding/progress'
import { isSilentAnswer } from './silent-answer'
import { escapeBehavior } from './escape-behavior'
import { SessionNotePill } from './session-note-pill'
import { useSessionNote } from './use-session-note'

// The compact bar at the bottom centre of the screen, under the assistant pill. While a session is collapsed it
// grows a prompt row and a live transcript preview above its controls. Until a requested answer starts streaming,
// a "Processing request..." status covers the assistant pill, just above the bar; when a recording
// stops, the same place asks whether to save the session's summary and handoff. Holding Command shows the
// shortcut sheet there. When the app opens, a short launch intro stands in the bar's place first.
export function OverlayBar({ session }: { session: SessionDetail | null }) {
  const ws = useWorkspace()
  const draftSession = ws.state?.activeSessionId || null
  const [barDraft, setBarDraft] = useState({ sessionId: draftSession, value: '' })
  if (barDraft.sessionId !== draftSession) setBarDraft({ sessionId: draftSession, value: '' })
  const { liveCaptions, overlayStreaming, overlayAnswer } = useWorkspaceLive()
  const { t } = useT()
  const note = useSessionNote()
  const sheet = useShortcutSheet(ws.api)
  const { pinned, setPinned } = sheet
  const { api, act } = ws
  const expanded = Boolean(ws.state?.overlay.expanded)
  // Escape closes the shortcut sheet or panel before leaving a focused field or hiding the bar.
  useEffect(() => {
    const escape = () => {
      const focused = document.activeElement
      const action = escapeBehavior({
        pinned,
        expanded,
        editing: focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement,
      })
      if (action === 'shortcuts') setPinned(false)
      else if (action === 'panel')
        void act(async () => {
          await api.expandOverlay(false)
        })
      else if (action === 'blur' && focused instanceof HTMLElement) focused.blur()
      else void api.toggleOverlay()
    }
    window.addEventListener('floating-escape', escape)
    return () => window.removeEventListener('floating-escape', escape)
  }, [api, act, expanded, pinned, setPinned])
  const intro = useLaunchIntro(Boolean(ws.state))
  const state = ws.state
  const requestedWelcome = useRef(false)
  const presentWelcome = Boolean(ws.state && shouldPresentOnboarding(ws.state))
  useEffect(() => {
    if (!presentWelcome || requestedWelcome.current) return
    requestedWelcome.current = true
    void act(async () => {
      await api.expandOverlay(true)
    })
  }, [presentWelcome, api, act])
  if (!state || presentWelcome) return null
  if (intro)
    return (
      <div data-floating-bar className="flex shrink-0 flex-col items-center">
        <BarLaunch />
      </div>
    )
  if (!state) return null
  const barRows = state.overlay.barRows ?? { prompt: false, preview: false, guide: false }
  const processing = overlayStreaming && isSilentAnswer(overlayAnswer)
  const asking = !processing && note.phase !== 'idle'
  const lastTranscript = session?.entries.filter((entry) => entry.kind === 'transcript').at(-1)
  const listening = Boolean(state.overlay.listening?.active)
  const answers = Boolean(overlayAnswer) || Boolean(session?.entries.some((entry) => entry.kind === 'assistant'))
  return (
    <div data-floating-bar className="flex shrink-0 flex-col items-center gap-2">
      <div className="grid justify-items-center">
        <div
          className={`[grid-area:1/1] ${(processing || asking || sheet.open) && !ws.captureState ? 'invisible' : ''}`}
        >
          {ws.captureState ? <CaptureNotice compact /> : <AssistantPicker />}
        </div>
        {processing && !ws.captureState ? (
          <p
            role="status"
            className="flex h-[30px] max-w-[300px] items-center rounded-[10px] border border-white/15 bg-black/90 px-3 text-[13px] text-foreground shadow-lg animate-in duration-500 fade-in [grid-area:1/1] motion-reduce:animate-none"
          >
            {t('overlay.processing')}
          </p>
        ) : null}
        {asking && !ws.captureState ? <SessionNotePill note={note} /> : null}
        {sheet.open && !ws.captureState ? (
          <div className="self-end [grid-area:1/1]">
            <ShortcutSheet
              groups={shortcutHints(state.shortcutDefinitions, { listening, answers })}
              listening={listening}
            />
          </div>
        ) : null}
      </div>
      <div
        data-thinking={overlayStreaming || undefined}
        className={`bar-card flex flex-col gap-2 border border-white/10 bg-surface/95 px-2.5 py-2 shadow-2xl ${barRows.prompt || barRows.preview || barRows.guide ? 'w-full max-w-[30rem] rounded-2xl' : 'rounded-full'}`}
      >
        {barRows.guide ? <BarGuide /> : null}
        {barRows.preview ? (
          <BarTranscriptPreview
            captions={liveCaptions}
            connecting={Boolean(state.overlay.listening?.starting)}
            lastLine={
              lastTranscript
                ? { speaker: lastTranscript.speaker === 'ME' ? 'me' : 'them', text: lastTranscript.content }
                : null
            }
          />
        ) : null}
        {barRows.prompt ? (
          <BarPrompt
            key={state.activeSessionId}
            value={barDraft.sessionId === draftSession ? barDraft.value : ''}
            onChange={(next) =>
              setBarDraft((current) => {
                if (current.sessionId !== draftSession) return current
                const value = typeof next === 'function' ? next(current.value) : next
                return { ...current, value }
              })
            }
          />
        ) : null}
        <BarControls shortcutsOpen={sheet.pinned} onShortcuts={() => sheet.setPinned(!sheet.pinned)} />
      </div>
    </div>
  )
}
