import { useCallback, useEffect, useState } from 'react'
import type { HistoryStats } from '@/bridge/types/sessions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { AppFolders } from './app-folders'
import { ClearHistory } from './clear-history'
import './data-settings.css'

export function DataManagement() {
  const ws = useWorkspace()
  const { t } = useT()
  const [stats, setStats] = useState<HistoryStats | null>(null)
  const [failed, setFailed] = useState(false)
  const load = useCallback(
    () =>
      ws.api.historyStats().then(
        (value) => ({ stats: value, failed: false }),
        () => ({ stats: null, failed: true }),
      ),
    [ws.api],
  )
  const apply = useCallback((result: { stats: HistoryStats | null; failed: boolean }) => {
    if (result.stats) setStats(result.stats)
    setFailed(result.failed)
  }, [])
  const refresh = useCallback(async () => apply(await load()), [load, apply])
  // The first read arrives after the screen shows; one that lands after leaving it is dropped.
  useEffect(() => {
    let current = true
    void load().then((result) => {
      if (current) apply(result)
    })
    return () => {
      current = false
    }
  }, [load, apply])
  const items = [
    { key: 'data.sessions', value: stats?.totalSessions },
    { key: 'data.messages', value: stats?.totalMessages },
    { key: 'data.transcripts', value: stats?.totalTranscriptions },
  ] as const
  return (
    <div className="data-settings grid gap-5">
      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle role="heading" aria-level={2}>
              {t('data.savedTitle')}
            </CardTitle>
            <CardDescription className="mt-1.5">{t('data.savedDescription')}</CardDescription>
          </div>
          <Badge variant="outline">{t('data.localStorage')}</Badge>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-3 border-t pt-5">
            {items.map((item) => (
              <div key={item.key} className="min-w-0">
                <dt className="text-sm text-muted-foreground">{t(item.key)}</dt>
                <dd className="mt-1 text-[28px] font-semibold tabular-nums">{item.value ?? '—'}</dd>
              </div>
            ))}
          </dl>
          {failed ? (
            <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 text-sm text-destructive">
              <p>{t('data.statsFailed')}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
                {t('data.retry')}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <AppFolders />
      <ClearHistory stats={stats} unavailable={failed} onCleared={refresh} />
    </div>
  )
}
