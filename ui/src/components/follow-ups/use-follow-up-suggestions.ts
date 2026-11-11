import { useCallback, useEffect, useRef, useState } from 'react'
import type { FollowUpSuggestion } from '@/bridge/types/generation'
import { errorMessage } from '@/format'
import { useWorkspace } from '@/workspace'

// Follow-up suggestions for one answer: generated on request, or automatically once the answer is long enough and
// nothing else is running. One request at a time; a new answer clears what came before it.
export function useFollowUpSuggestions({
  sessionId,
  entryId,
  responseLength,
  auto,
  limit,
}: {
  sessionId: string
  entryId: string
  responseLength: number
  auto: boolean
  limit: number
}) {
  const ws = useWorkspace()
  const request = useRef<string | null>(null)
  const [suggestions, setSuggestions] = useState<FollowUpSuggestion[]>([])
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const { api } = ws
  const cancel = useCallback(() => {
    const id = request.current
    request.current = null
    if (id) void api.cancel(id).catch(() => {})
  }, [api])
  useEffect(() => () => cancel(), [cancel])
  // A new answer clears these suggestions in the same render it starts.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [answering, setAnswering] = useState(ws.requestId)
  if (answering !== ws.requestId) {
    setAnswering(ws.requestId)
    if (ws.requestId) {
      setBusy(false)
      setSuggestions([])
      setLoaded(false)
      setError('')
    }
  }
  useEffect(() => {
    if (ws.requestId) cancel()
  }, [ws.requestId, cancel])
  const generate = async () => {
    if (request.current || ws.requestId || responseLength < 50) return
    const id = crypto.randomUUID()
    request.current = id
    setBusy(true)
    setError('')
    setSuggestions([])
    setLoaded(false)
    try {
      const result = await ws.api.followUps({ requestId: id, sessionId, entryId })
      if (request.current !== id || result.entryId !== entryId) return
      setSuggestions(result.suggestions.slice(0, limit))
      setLoaded(true)
    } catch (cause) {
      if (request.current === id) setError(errorMessage(cause))
    } finally {
      if (request.current === id) {
        request.current = null
        setBusy(false)
      }
    }
  }
  // Generates once per answer, after the answer has finished and nothing else is running.
  const automatic = useRef<string | null>(null)
  useEffect(() => {
    if (!auto || ws.requestId || responseLength < 50 || automatic.current === entryId) return
    automatic.current = entryId
    void generate()
  })
  return {
    suggestions,
    busy,
    loaded,
    error,
    disabled: busy || Boolean(ws.requestId) || responseLength < 50,
    requesting: Boolean(ws.requestId),
    generate: () => void generate(),
    stop: () => {
      cancel()
      setBusy(false)
    },
    select: (prompt: string) => void ws.act(() => ws.runGeneration('chat', prompt)),
  }
}
