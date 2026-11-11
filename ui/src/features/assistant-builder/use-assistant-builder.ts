import { onboardingReadiness } from '@/features/onboarding/readiness'
import { useEffect, useRef, useState } from 'react'
import type { AssistantDraft, BuilderReply } from '@/bridge/types/assistants'
import { errorMessage } from '@/format'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { queueProposals, withExchange, withStatus, type ProposalItem, type Turn } from './builder-proposals'

// The builder conversation: one request at a time, cancelled when the panel closes; a reply replaces the draft and
// queues its proposals, which apply one by one.
export function useAssistantBuilder() {
  const ws = useWorkspace()
  const { t } = useT()
  const [draft, setDraft] = useState<AssistantDraft>()
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<BuilderReply['results']>([])
  const [proposals, setProposals] = useState<ProposalItem[]>([])
  const [finished, setFinished] = useState(false)
  const proposalId = useRef(0)
  const request = useRef<string | null>(null)
  useEffect(
    () => () => {
      const id = request.current
      request.current = null
      if (id) void ws.api.cancel(id)
    },
    [ws.api],
  )
  const cancel = () => {
    const id = request.current
    request.current = null
    setBusy(false)
    if (id) void ws.api.cancel(id).catch(() => {})
  }
  // A request already running wins; an answered question is cleared by `answered`.
  const submit = async (text: string, answered: () => void) => {
    if (request.current) return
    if (!ws.state || !onboardingReadiness(ws.state).insights) {
      setError(t('error.connectAiModel'))
      return
    }
    const id = crypto.randomUUID()
    request.current = id
    setBusy(true)
    setError('')
    try {
      const result = await ws.api.buildAssistant({ requestId: id, question: text, draft, history: turns.slice(-4) })
      if (request.current !== id) return
      setDraft(result.draft)
      setResults(result.results)
      setProposals((current) => queueProposals(current, result.proposals, () => proposalId.current++))
      setFinished(result.finished)
      setTurns((previous) => withExchange(previous, text, result.message))
      answered()
    } catch (cause) {
      if (request.current === id) setError(errorMessage(cause))
    } finally {
      if (request.current === id) {
        request.current = null
        setBusy(false)
      }
    }
  }
  const apply = (id: number) => {
    const item = proposals.find((entry) => entry.id === id)
    if (!item || item.status !== 'pending') return
    setProposals((current) => withStatus(current, id, 'applying'))
    void ws.api.applyBuilderAction({ proposal: item.proposal, draft }).then(
      (result) =>
        setProposals((current) =>
          withStatus(
            current,
            id,
            'done',
            t(`builder.done.${result.tool}`, { name: result.name, category: result.category || '' }),
          ),
        ),
      (cause) => setProposals((current) => withStatus(current, id, 'error', errorMessage(cause))),
    )
  }
  return {
    draft,
    turns,
    busy,
    error,
    results,
    proposals,
    finished,
    submit,
    cancel,
    apply,
    dismiss: (id: number) => setProposals((current) => current.filter((entry) => entry.id !== id)),
  }
}
