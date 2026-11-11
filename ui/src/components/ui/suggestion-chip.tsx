import type { ComponentProps } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Button } from './button'
import './suggestion-chip.css'

export function SuggestionChip({ children, className = '', ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      type="button"
      variant="outline"
      size="sm"
      className={`suggestion-chip h-auto whitespace-normal text-left ${className}`}
    >
      <span>{children}</span>
      <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
    </Button>
  )
}
