import { useEffect, useState } from 'react'
import { errorMessage } from '@/format'
import type { SessionPage } from '@/bridge/types/sessions'
import { useWorkspace } from '@/workspace'
import { lastPageIndex, pageCount } from './page-count'

// Three rows of three cards.
const PAGE_SIZE = 9

// A fetched page with the request it answers, so a late answer to an older request is never shown.
interface PageResult {
  asked: { page: number; query: string; includeTranscript: boolean; sessions: unknown }
  data: SessionPage | null
  error: string
}

// Debounced, cancellable fetch of one page of past sessions. Resets to page 0 when the search or the
// include-transcript scope changes, and clamps to the last page if the current one no longer exists.
export function useSessionsPage() {
  const ws = useWorkspace()
  const { api, query } = ws
  const [page, setPage] = useState(0)
  const [includeTranscript, setIncludeTranscript] = useState(false)
  // A new search or scope starts again from the first page, in the same render.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [scope, setScope] = useState({ query, includeTranscript })
  if (scope.query !== query || scope.includeTranscript !== includeTranscript) {
    setScope({ query, includeTranscript })
    setPage(0)
  }
  const ready = Boolean(ws.state)
  const sessions = ws.state?.sessions
  const [result, setResult] = useState<PageResult | null>(null)
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const asked = { page, query, includeTranscript, sessions }
    const timer = window.setTimeout(() => {
      void api
        .sessionsPage({
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          search: query,
          excludeActive: true,
          scope: includeTranscript ? 'all' : 'conversation',
        })
        .then((data) => {
          if (cancelled) return
          const last = lastPageIndex(data.total, PAGE_SIZE)
          if (page > last) setPage(last)
          else setResult({ asked, data, error: '' })
        })
        .catch((cause) => {
          if (!cancelled) setResult({ asked, data: null, error: errorMessage(cause) })
        })
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [api, query, page, includeTranscript, ready, sessions])
  // Only the answer to the current request is shown; until it arrives the page counts as loading.
  const asked = result?.asked
  const current =
    asked &&
    asked.page === page &&
    asked.query === query &&
    asked.includeTranscript === includeTranscript &&
    asked.sessions === sessions
      ? result
      : null
  const data = current?.data ?? null
  return {
    page,
    setPage,
    rows: data?.sessions || [],
    total: data?.total || 0,
    pageCount: pageCount(data?.total || 0, PAGE_SIZE),
    pageSize: PAGE_SIZE,
    loading: !current,
    error: current?.error ?? '',
    includeTranscript,
    setIncludeTranscript,
  }
}
