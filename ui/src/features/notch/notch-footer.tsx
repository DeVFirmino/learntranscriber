import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

// Moving between the session's insights, where the Notch is among them, and capturing the screen.
export function NotchFooter({
  count,
  position,
  onMove,
}: {
  count: number
  position: number
  onMove: (direction: number) => void
}) {
  const ws = useWorkspace()
  const { t } = useT()
  return (
    <div className="mt-3 flex items-center gap-2">
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={count < 2 || position === 0}
        aria-label={t('notch.previous')}
        onClick={() => onMove(-1)}
      >
        <ChevronLeft />
      </Button>
      <span className="text-xs text-muted-foreground">
        {count ? t('notch.position', { current: position < 0 ? count : position + 1, total: count }) : t('notch.none')}
      </span>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={!count || position < 0}
        aria-label={t('notch.next')}
        onClick={() => onMove(1)}
      >
        <ChevronRight />
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => void ws.act(() => ws.api.dispatchShortcut('capture').then(() => undefined))}
      >
        {t('notch.capture')}
      </Button>
    </div>
  )
}
