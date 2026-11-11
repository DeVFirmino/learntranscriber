import type { ComponentProps, ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from 'cn'
import { Button } from './button'
import './action-button.css'

// Primary text actions share one animated surface; native button and form behavior stays with the caller.
export function ActionButton({
  children,
  icon,
  tone = 'default',
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, 'variant' | 'asChild'> & {
  icon?: ReactNode
  tone?: 'default' | 'contrast'
}) {
  return (
    <Button {...props} data-action-button data-tone={tone} className={cn('action-button', className)}>
      <span className="action-button-fill" aria-hidden="true" />
      <span className="action-button-mark" aria-hidden="true">
        {icon ?? <span className="action-button-dot" />}
      </span>
      <span className="action-button-label">{children}</span>
      <ArrowRight className="action-button-arrow" aria-hidden="true" />
    </Button>
  )
}
