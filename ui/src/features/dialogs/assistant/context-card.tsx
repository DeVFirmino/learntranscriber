import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

// One collapsible card of the assistant context: a chevron and title that toggle its body, and an optional action
// that stays reachable while it is closed.
export function ContextCard({
  icon,
  title,
  action,
  open,
  onOpen,
  children,
}: {
  icon: ReactNode
  title: string
  action?: ReactNode
  open: boolean
  onOpen: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpen}
      className="grid min-h-24 content-start gap-3 rounded-xl border border-border bg-background/40 p-4"
    >
      <div className="flex min-h-9 items-center gap-2">
        <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-2 rounded-md text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronRight
            className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-90 motion-reduce:transition-none"
            aria-hidden="true"
          />
          {icon}
          <span className="truncate">{title}</span>
        </CollapsibleTrigger>
        {action}
      </div>
      <CollapsibleContent className="grid gap-2">{children}</CollapsibleContent>
    </Collapsible>
  )
}
