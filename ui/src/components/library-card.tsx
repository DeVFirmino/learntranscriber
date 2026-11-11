import type { ReactNode } from 'react'
import './library-card.css'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

// One item of a library grid (an assistant, a past session): its glyph, title and menu, a row of badges, and the body.
export function LibraryCard({
  glyph,
  title,
  menu,
  badges,
  selected = false,
  footer,
  children,
  ...data
}: {
  glyph: ReactNode
  title: ReactNode
  menu: ReactNode
  badges: ReactNode
  selected?: boolean
  footer?: ReactNode
  children: ReactNode
} & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <Card {...data} className={selected ? 'min-w-0 border-primary/60' : 'min-w-0'}>
      <CardHeader className="gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {glyph}
          <CardTitle className="min-w-0 flex-1 text-base [overflow-wrap:anywhere]">{title}</CardTitle>
          {menu}
        </div>
        <div className="flex flex-wrap gap-1.5">{badges}</div>
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  )
}
