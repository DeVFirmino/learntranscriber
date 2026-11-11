import type { ComponentProps } from 'react'
import { cn } from 'cn'

export function MessageBubble({
  role,
  className,
  ...props
}: ComponentProps<'article'> & { role: 'user' | 'assistant' | 'context' }) {
  return <article {...props} data-message-role={role} className={cn('message-bubble', className)} />
}
