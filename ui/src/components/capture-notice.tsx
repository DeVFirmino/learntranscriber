import { Check, ScanLine, TriangleAlert } from 'lucide-react'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

const CAPTURE_ICONS = { captured: Check, error: TriangleAlert, capturing: ScanLine } as const

export function CaptureNotice({ compact = false }: { compact?: boolean }) {
  const { captureState } = useWorkspace()
  const { t } = useT()
  if (!captureState) return null
  const { phase } = captureState
  const Icon = CAPTURE_ICONS[phase]
  return (
    <div
      data-capture-state={phase}
      role={phase === 'error' ? 'alert' : 'status'}
      className={`pointer-events-none flex max-w-[calc(100vw-24px)] items-center gap-2 rounded-xl border border-primary/40 bg-surface px-3 py-2 text-sm text-foreground shadow-lg ${compact ? '' : 'fixed right-4 bottom-4 z-50 w-80'}`}
    >
      <Icon
        aria-hidden="true"
        className={`size-5 shrink-0 text-primary ${phase === 'capturing' ? 'animate-pulse motion-reduce:animate-none' : ''}`}
      />
      <div className="min-w-0">
        <p className="font-medium">{t(`capture.${phase}`)}</p>
        {!compact ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t(phase === 'error' ? 'capture.retryHint' : 'capture.hint')}
          </p>
        ) : null}
      </div>
    </div>
  )
}
