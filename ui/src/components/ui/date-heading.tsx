import { BrandCalendar } from '@/components/brand-icon'

export function DateHeading({ label, date }: { label: string; date: string }) {
  return (
    <h2 className="flex min-w-0 items-center gap-3 text-xs font-medium text-muted-foreground">
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5">
        <BrandCalendar aria-hidden="true" className="size-3.5 text-primary" />
        <time dateTime={date}>{label}</time>
      </span>
      <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-border" />
    </h2>
  )
}
