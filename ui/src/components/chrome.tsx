import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { documentT } from '@/i18n'

export function PageHeading({
  title,
  description,
  children,
  onTitleClick,
}: {
  title: string
  description: string
  children?: ReactNode
  onTitleClick?: () => void
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 tabIndex={-1} className="w-fit rounded-md text-[28px] leading-tight font-semibold tracking-[-0.025em]">
          {onTitleClick ? (
            <button
              type="button"
              className="rounded-md text-left decoration-muted-foreground/50 underline-offset-4 hover:underline"
              title={documentT('app.rename')}
              onClick={onTitleClick}
            >
              {title}
            </button>
          ) : (
            title
          )}
        </h1>
        <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {children ? <div className="page-heading-actions flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}

export function Empty({ children }: { children: string }) {
  return <p className="py-6 text-sm text-muted-foreground">{children}</p>
}

export function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4">
      <div className="min-w-0 max-w-[65ch]">
        <div className="text-sm font-medium">{title}</div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-relaxed text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

export function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

export function TextButton(props: React.ComponentProps<typeof Button>) {
  return <Button type="button" variant="outline" {...props} />
}
