import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { showError } from './error-toast'
import type { SelectionValue } from '@/bridge/types/context'
import type { PublicState } from '@/bridge/types/state'
import { errorMessage, isSafeScreenshot, localizeMessage } from '@/format'
import { documentT } from '@/i18n'
import type { TextContext } from '@/workspace'
import { appendScreenshot, type PendingImage } from './attachments'
import { useLatest } from './use-latest'

// What the next question carries: the queued screenshots, and text selected in another app to review first.
export function usePendingContext(workspace: { overlay: () => boolean; state: () => PublicState | null }) {
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [pendingText, setPendingText] = useState<TextContext | null>(null)
  const imagesRef = useLatest(pendingImages)
  const textRef = useLatest(pendingText)
  const replaceImages = (value: PendingImage[]) => {
    imagesRef.current = value
    setPendingImages(value)
  }
  const addPendingImage = (data: string) =>
    replaceImages(appendScreenshot(imagesRef.current, data, { isSafeScreenshot, newId: () => crypto.randomUUID() }))
  useEffect(() => {
    const onCaptured = (event: Event) => {
      const image = (event as CustomEvent<unknown>).detail
      try {
        if (typeof image !== 'string') throw new Error('Invalid screenshot event.')
        addPendingImage(image)
      } catch (error) {
        showError(errorMessage(error))
      }
    }
    window.addEventListener('screenshot-captured', onCaptured)
    return () => window.removeEventListener('screenshot-captured', onCaptured)
  })
  // Text selected for one live session is dropped when another one becomes live.
  const followSession = (activeSessionId: string | null) => {
    if (textRef.current && textRef.current.sessionId !== activeSessionId) setPendingText(null)
  }
  const selection = (value: SelectionValue) => {
    const state = workspace.state()
    if (workspace.overlay() || !state || value.sessionId !== state.activeSessionId) return
    setPendingText({
      text: value.text,
      sessionId: value.sessionId,
      label: documentT('session.selectedText') + (value.application ? ` · ${value.application}` : ''),
    })
    toast.message(localizeMessage('Selected text is ready to review for your next question.'))
  }
  const actions = {
    addPendingImage,
    removePendingImage: (id: string) => replaceImages(imagesRef.current.filter((item) => item.id !== id)),
    setPendingText,
    patchPendingText: (text: string) => setPendingText((current) => (current ? { ...current, text } : current)),
  }
  return { pendingImages, pendingText, imagesRef, textRef, replaceImages, followSession, selection, actions }
}
