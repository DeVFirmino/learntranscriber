import { GripVertical, Minus, Maximize2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/use-t'

export function ComposerHeader({
  compact = false,
  minimized = false,
  onToggle,
  onClose,
}: {
  compact?: boolean
  minimized?: boolean
  onToggle?: () => void
  onClose?: () => void
}) {
  const { t } = useT()
  if (!compact && !onToggle && !onClose) return null
  return (
    <div className={`floating-question-shortcut ${compact ? 'drag-region' : ''}`}>
      {compact ? (
        <span className="composer-grip" title={t('overlay.drag')}>
          <GripVertical aria-hidden="true" className="size-4" />
        </span>
      ) : null}
      {minimized ? <span className="text-xs">{t('overlay.followUp')}</span> : null}
      <span className="ml-auto inline-flex items-center gap-1" data-no-drag>
        {onToggle ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onToggle}
            aria-label={t(minimized ? 'overlay.restoreComposer' : 'overlay.minimizeComposer')}
            title={t(minimized ? 'overlay.restoreComposer' : 'overlay.minimizeComposer')}
          >
            {minimized ? <Maximize2 aria-hidden="true" /> : <Minus aria-hidden="true" />}
          </Button>
        ) : null}
        {onClose ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onClose}
            aria-label={t('overlay.minimize')}
            title={t('overlay.minimize')}
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </span>
    </div>
  )
}
