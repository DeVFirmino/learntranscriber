import { useT } from '@/use-t'

// Completed steps are shown as a share of the whole, so a fresh profile starts with visible progress, not zero.
export function SetupProgressBar({ completed, total }: { completed: number; total: number }) {
  const { t } = useT()
  const label = t('onboarding.progress', { done: completed, total })
  return (
    <div className="grid gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>
    </div>
  )
}
