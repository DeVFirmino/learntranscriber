import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { HistoryStats } from '@/bridge/types/sessions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { ClearConfirmation } from './clear-confirmation'

export function ClearHistory({
  stats,
  unavailable,
  onCleared,
}: {
  stats: HistoryStats | null
  unavailable: boolean
  onCleared: () => Promise<void>
}) {
  const ws = useWorkspace()
  const { t } = useT()
  const [confirming, setConfirming] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const inFlight = useRef(false)
  const active = Boolean(ws.state?.activeSessionId)
  const disabled = clearing || active || unavailable || !stats || stats.totalSessions === 0
  const clear = async () => {
    if (disabled || inFlight.current) return
    inFlight.current = true
    setClearing(true)
    setConfirming(false)
    setResult(null)
    try {
      await ws.api.clearHistory()
      await onCleared()
      setResult('success')
    } catch {
      setResult('error')
    } finally {
      inFlight.current = false
      setClearing(false)
    }
  }
  return (
    <>
      <Card className="data-delete-card">
        <CardContent className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <h2 ref={heading} tabIndex={-1} className="text-base font-semibold outline-none">
              {t('data.deleteTitle')}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t('data.deleteDescription')}</p>
            {active ? <p className="mt-2 text-sm text-muted-foreground">{t('data.endSessionFirst')}</p> : null}
          </div>
          <Button
            ref={trigger}
            type="button"
            variant="destructive"
            className="shrink-0"
            disabled={disabled}
            onClick={() => {
              setResult(null)
              setConfirming(true)
            }}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {t(clearing ? 'data.deleting' : 'data.deleteAction')}
          </Button>
        </CardContent>
      </Card>
      {result ? (
        <p
          role={result === 'error' ? 'alert' : 'status'}
          className={result === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
        >
          {t(result === 'error' ? 'data.deleteFailed' : 'data.deleted')}
        </p>
      ) : null}
      {stats ? (
        <ClearConfirmation
          open={confirming}
          onOpenChange={setConfirming}
          onRestoreFocus={() => {
            if (trigger.current?.disabled) heading.current?.focus()
            else trigger.current?.focus()
          }}
          stats={stats}
          disabled={disabled}
          onClear={() => void clear()}
        />
      ) : null}
    </>
  )
}
