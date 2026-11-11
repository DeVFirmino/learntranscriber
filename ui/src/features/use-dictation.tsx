import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { QuestionDictation } from '@/audio/dictation'
import { errorMessage } from '@/format'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { showError } from '@/features/workspace/error-toast'

// Dictates into a text field for review: each transcribed phrase is appended, nothing is sent on its own.
// Meeting listening and dictation never run together, and leaving the screen cancels the recording.
export function useDictation(onText: (text: string) => void) {
  const ws = useWorkspace()
  const { t } = useT()
  const [active, setActive] = useState(false)
  const capture = useRef<QuestionDictation | null>(null)
  const version = useRef(0)
  const append = useRef(onText)
  useEffect(() => {
    append.current = onText
  })
  useEffect(
    () => () => {
      version.current += 1
      if (capture.current) ws.setDictating(false)
      capture.current?.cancel()
      capture.current = null
    },
    [ws],
  )

  async function start() {
    if (ws.mode === 'mock') {
      toast.message(t('memoryDialog.previewDictate'))
      return
    }
    if (ws.audio.recording || ws.audio.starting || ws.audio.stopping) {
      showError(t('memoryDialog.stopMeeting'))
      return
    }
    const stamp = ++version.current
    setActive(true)
    ws.setDictating(true)
    const dictation = new QuestionDictation(
      ws.api,
      (text) => {
        if (version.current === stamp) append.current(text)
      },
      (message) => {
        if (version.current === stamp) showError(message)
      },
      () => {
        if (version.current === stamp) {
          setActive(false)
          ws.setDictating(false)
          capture.current = null
        }
      },
    )
    capture.current = dictation
    try {
      await dictation.start(ws.state!.settings)
    } catch (error) {
      if (version.current === stamp) {
        showError(errorMessage(error))
        setActive(false)
        ws.setDictating(false)
        capture.current = null
      }
    }
  }

  function stop() {
    void capture.current?.stop().catch((error: unknown) => showError(errorMessage(error)))
  }

  return { active, toggle: () => (active ? stop() : void start()) }
}
