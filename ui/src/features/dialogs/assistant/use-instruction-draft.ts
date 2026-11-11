import { useEffect, useRef, useState } from 'react'
import { onboardingReadiness } from '@/features/onboarding/readiness'
import { errorMessage } from '@/format'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { draftQuestion } from './instruction-draft'

// Drafting the editor's instructions with the assistant builder: one request at a time, cancelled when the editor
// closes, and its answer handed back to replace the box.
export function useInstructionDraft(onDraft: (draft: { name: string; category: string; prompt: string }) => void) {
  const ws = useWorkspace()
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<string | null>(null)
  useEffect(
    () => () => {
      const id = request.current
      request.current = null
      if (id) void ws.api.cancel(id).catch(() => {})
    },
    [ws.api],
  )
  const draft = async (input: { name: string; category: string; brief: string }) => {
    if (request.current || !input.brief.trim()) return
    if (!ws.state || !onboardingReadiness(ws.state).insights) {
      setError(t('error.connectAiModel'))
      return
    }
    const id = crypto.randomUUID()
    request.current = id
    setBusy(true)
    setError('')
    try {
      const reply = await ws.api.buildAssistant({ requestId: id, question: draftQuestion(input) })
      if (request.current !== id) return
      onDraft({ name: reply.draft.name, category: reply.draft.category, prompt: reply.draft.systemPrompt })
    } catch (cause) {
      if (request.current === id) setError(errorMessage(cause))
    } finally {
      if (request.current === id) {
        request.current = null
        setBusy(false)
      }
    }
  }
  const cancel = () => {
    const id = request.current
    request.current = null
    setBusy(false)
    if (id) void ws.api.cancel(id).catch(() => {})
  }
  return { busy, error, draft, cancel }
}
