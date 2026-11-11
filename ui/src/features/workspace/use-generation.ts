import { useState } from 'react'
import { toast } from 'sonner'
import type { WorkspaceApi } from '@/bridge/types/api'
import type { PublicState } from '@/bridge/types/state'
import { localizeMessage } from '@/format'
import type { TextContext } from '@/workspace'
import type { PendingImage } from './attachments'
import { GenerationController } from './generation-controller'
import type { WorkspaceEvents } from './use-workspace-events'

// The answer this window is generating: the question, the words streamed so far, and the screen captured for it.
export function useGeneration(
  api: WorkspaceApi,
  hooks: {
    state: () => PublicState | null
    overlay: () => boolean
    selectedId: () => string | null
    shownSessionId: () => string | undefined
    pending: {
      textRef: { current: TextContext | null }
      imagesRef: { current: PendingImage[] }
      replaceImages: (images: PendingImage[]) => void
      actions: { addPendingImage: (image: string) => void; setPendingText: (value: TextContext | null) => void }
    }
    refresh: () => Promise<void>
    ensureSession: () => Promise<void>
  },
) {
  const [answer, setAnswer] = useState('')
  const [pendingQuestion, setPendingQuestion] = useState('')
  const [requestId, setRequestId] = useState<string | null>(null)
  const { pending } = hooks
  const [generation] = useState(
    () =>
      new GenerationController({
        generate: (input) => api.generate(input as Parameters<typeof api.generate>[0]),
        capture: () => api.capture(),
        state: hooks.state,
        overlay: hooks.overlay,
        selectedId: hooks.selectedId,
        shownSessionId: hooks.shownSessionId,
        reviewedText: () => pending.textRef.current,
        clearReviewedText: (sent) => {
          if (pending.textRef.current === sent) pending.actions.setPendingText(null)
        },
        images: () => pending.imagesRef.current,
        replaceImages: (images) => pending.replaceImages(images),
        attach: (image) => pending.actions.addPendingImage(image),
        began: (id, question) => {
          setRequestId(id)
          setAnswer('')
          setPendingQuestion(question)
        },
        ended: () => {
          setRequestId(null)
          setAnswer('')
          setPendingQuestion('')
        },
        refresh: hooks.refresh,
        ensureSession: hooks.ensureSession,
        attachedNotice: () =>
          toast.message(localizeMessage('Screen attached. Ask a question to send it to your provider.')),
        newId: () => crypto.randomUUID(),
      }),
  )
  const delta: WorkspaceEvents['delta'] = (value) => {
    if (value.requestId !== generation.requestId) return
    setAnswer((current) => current + value.delta)
  }
  const actions = {
    captureScreen: () => generation.capture(),
    runGeneration: async (mode: string, question?: string, image?: string) => {
      await generation.run(mode, question, image)
    },
  }
  return { generation, answer, pendingQuestion, requestId, delta, actions }
}
