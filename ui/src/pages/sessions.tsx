import { ActionButton } from '@/components/ui/action-button'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SearchField } from '@/components/ui/search-field'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, PageHeading } from '@/components/chrome'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { PaginationFooter } from '@/features/sessions/pagination-footer'
import { SessionGroups } from '@/features/sessions/session-groups'
import { selectionScope, toggleSessionSelection, visibleSessionSelection } from '@/features/sessions/session-selection'
import { useSessionsPage } from '@/features/sessions/use-sessions-page'

// Past sessions: search (optionally over transcript text) and a paged grid of session cards grouped by day, with a
// selection mode to delete several at once.
export function Sessions() {
  const ws = useWorkspace()
  const { t } = useT()
  const { page, setPage, rows, total, pageCount, pageSize, loading, error, includeTranscript, setIncludeTranscript } =
    useSessionsPage()
  const [selecting, setSelecting] = useState(false)
  const scope = selectionScope(page, ws.query, includeTranscript)
  const [picked, setPicked] = useState(() => ({ scope, ids: new Set<string>() }))
  if (picked.scope !== scope) setPicked({ scope, ids: new Set() })
  const selected = visibleSessionSelection(picked, scope, rows)
  const toggle = (id: string) => setPicked((current) => toggleSessionSelection(current, id))
  const stopSelecting = () => {
    setSelecting(false)
    setPicked({ scope, ids: new Set() })
  }
  if (!ws.state) return null
  return (
    <div>
      <PageHeading title={t('sessions.title')} description={t('sessions.description')}>
        {selecting ? (
          <>
            <span className="self-center text-sm text-muted-foreground" role="status">
              {t('sessions.selected', { count: selected.size })}
            </span>
            <Button variant="outline" onClick={stopSelecting}>
              {t('data.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={!selected.size}
              onClick={() =>
                ws.setDialog({
                  type: 'session-delete',
                  ids: [...selected],
                  title: rows.find((session) => selected.has(session.id))?.title,
                })
              }
            >
              {t('sessions.deleteSelected', { count: selected.size })}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" disabled={!rows.length} onClick={() => setSelecting(true)}>
              {t('sessions.select')}
            </Button>

            <ActionButton onClick={() => void ws.act(() => ws.startFloatingSession())}>
              {t('sessions.new')}
            </ActionButton>
          </>
        )}
      </PageHeading>
      <section className="grid min-w-0 gap-4" aria-label={t('sessions.search')}>
        <SearchField
          value={ws.query}
          label={t('sessions.searchPlaceholder')}
          clearLabel={t('sessions.clearSearch')}
          onValueChange={(value) => void ws.search(value)}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={includeTranscript} onCheckedChange={(value) => setIncludeTranscript(value === true)} />
          {t('sessions.includeTranscript')}
        </label>
        {loading ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t('sessions.loading')}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {t('sessions.loadFailed', { error })}
          </p>
        ) : null}
        {!loading &&
          !error &&
          (rows.length ? (
            <SessionGroups rows={rows} selecting={selecting} selected={selected} onToggle={toggle} />
          ) : (
            <Empty>{ws.query ? t('sessions.noMatch') : t('sessions.empty')}</Empty>
          ))}
        {!loading && !error && total > 0 ? (
          <PaginationFooter
            page={page}
            pageCount={pageCount}
            from={page * pageSize + 1}
            to={page * pageSize + rows.length}
            total={total}
            onPage={setPage}
          />
        ) : null}
      </section>
    </div>
  )
}
