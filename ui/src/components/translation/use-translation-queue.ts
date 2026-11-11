import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { WorkspaceApi } from '@/bridge/types/api'
import type { Entry } from '@/bridge/types/sessions'
import { errorMessage } from '@/format'

export type TranslationResult = { source: string; status: 'pending' | 'done' | 'error'; text?: string; error?: string }

// The key one entry's translation is cached and requested under.
export const cacheKey = (sessionId: string, entry: Entry, language: string) => `${sessionId}::${entry.id}::${language}`

// Requests and caches translations for the visible participant entries, at most three in flight, retrying only
// what changed; closing the panel, or switching language or session, cancels everything in flight.
export function useTranslationQueue({
  sessionId,
  entries,
  language,
  open,
  api,
  visible,
}: {
  sessionId: string
  entries: Entry[]
  language: string
  open: boolean
  api: WorkspaceApi
  visible: string[]
}) {
  const [showOriginals, setShowOriginals] = useState(false)
  const [results, setResults] = useState<Record<string, TranslationResult>>({})
  const resultsRef = useRef(results)
  const active = useRef(new Map<string, string>())
  const scheduleRef = useRef<() => void>(() => {})
  const enabled = open && !showOriginals
  const update = useCallback((key: string, value: TranslationResult | undefined) => {
    const next = { ...resultsRef.current }
    if (value) next[key] = value
    else delete next[key]
    resultsRef.current = next
    setResults(next)
  }, [])
  const schedule = useCallback(() => {
    if (!enabled || !language.trim()) return
    for (const entry of [...entries].reverse()) {
      if (active.current.size >= 3) break
      if (entry.speaker !== 'THEY' || !entry.content.trim() || !visible.includes(entry.id)) continue
      const key = cacheKey(sessionId, entry, language),
        cached = resultsRef.current[key]
      if (cached?.source !== entry.content && cached) {
        const oldRequest = active.current.get(key)
        if (oldRequest) {
          active.current.delete(key)
          void api.cancel(oldRequest).catch(() => {})
        }
        update(key, undefined)
      } else if (cached) continue
      const requestId = crypto.randomUUID()
      active.current.set(key, requestId)
      update(key, { source: entry.content, status: 'pending' })
      void api
        .translateEntry({ requestId, sessionId, entryId: entry.id, language })
        .then((value) => {
          if (active.current.get(key) !== requestId) return
          update(key, { source: entry.content, status: 'done', text: value.text })
        })
        .catch((error) => {
          if (active.current.get(key) !== requestId) return
          update(key, { source: entry.content, status: 'error', error: errorMessage(error) })
        })
        .finally(() => {
          if (active.current.get(key) !== requestId) return
          active.current.delete(key)
          scheduleRef.current()
        })
    }
  }, [enabled, entries, visible, language, sessionId, api, update])
  useLayoutEffect(() => {
    scheduleRef.current = schedule
  }, [schedule])
  useEffect(() => {
    schedule()
  }, [schedule])
  useEffect(() => {
    if (enabled) return
    for (const [key, id] of active.current) {
      void api.cancel(id).catch(() => {})
      update(key, undefined)
    }
    active.current.clear()
  }, [enabled, api, update])
  useEffect(() => {
    // The running map is created once, so the cleanup cancels whatever is still running in it.
    const running = active.current
    return () => {
      for (const [key, id] of running) {
        void api.cancel(id).catch(() => {})
        update(key, undefined)
      }
      running.clear()
    }
  }, [sessionId, language, api, update])
  return {
    showOriginals,
    setShowOriginals,
    results,
    retry: (entry: Entry) => {
      update(cacheKey(sessionId, entry, language), undefined)
      queueMicrotask(() => scheduleRef.current())
    },
  }
}
