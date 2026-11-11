import { useLayoutEffect, useRef } from 'react'
import { dispatchAction, responseIndex } from './action-dispatch'
import { liveTranscript } from './insight-loop'

// What a shortcut or menu action does in this window. The handler is rebuilt after each render, so the action the
// main process sends sees the current state.
export function useShortcutActions(hooks: {
  overlay: () => boolean
  captureScreen: () => Promise<void>
  quickScreenshot: () => boolean
  recording: () => boolean
  togglePause: () => Promise<void>
  muteMicrophone: () => void
  toggleListening: () => Promise<void>
  insight: (transcript: string | undefined) => Promise<unknown>
  // An answer is already being written in this window.
  generating: () => boolean
  captions: () => Record<string, string>
  openQuestion: (question: string) => Promise<unknown>
}) {
  const actionRef = useRef<(action: string) => Promise<void>>(async () => {})
  const responsePosition = useRef<number | null>(null)
  useLayoutEffect(() => {
    actionRef.current = (action) =>
      dispatchAction(action, {
        overlay: hooks.overlay,
        floating: (event) => window.dispatchEvent(new CustomEvent(event)),
        go: (next) => {
          window.location.hash = next
        },
        capture: hooks.captureScreen,
        quickScreenshot: hooks.quickScreenshot,
        recording: hooks.recording,
        // Command-D while an answer is still being written is skipped rather than refused.
        insightNow: async () => {
          if (!hooks.generating()) await hooks.insight(liveTranscript(hooks.captions()) || undefined)
        },
        toggleListening: hooks.toggleListening,
        togglePause: hooks.togglePause,
        muteMicrophone: hooks.muteMicrophone,
        ask: async () => {
          await hooks.openQuestion('')
        },
        scroll: (direction) =>
          document
            .querySelector<HTMLElement>('[data-session-chat] [data-slot="scroll-area-viewport"]')
            ?.scrollBy({ top: direction * 150 }),
        showResponse: (direction) => {
          const responses = [...document.querySelectorAll<HTMLElement>('[data-response]')]
          const next = responseIndex(responsePosition.current, responses.length, direction)
          responsePosition.current = next
          responses[next]?.scrollIntoView({ block: 'start' })
        },
      })
  })
  return (action: string) => actionRef.current(action)
}
