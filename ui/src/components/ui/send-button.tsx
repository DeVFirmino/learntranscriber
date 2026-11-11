import type { ComponentProps } from 'react'
import { ArrowUp, LoaderCircle, Square } from 'lucide-react'
import { cn } from 'cn'
import { Button } from './button'
import './send-button.css'

export function SendButton({
  label,
  busy = false,
  onCancel,
  className,
  disabled,
  ...props
}: Omit<ComponentProps<'button'>, 'children'> & {
  label: string
  busy?: boolean
  onCancel?: () => void
}) {
  const cancelling = busy && Boolean(onCancel)
  let Icon = ArrowUp
  if (busy) Icon = LoaderCircle
  if (cancelling) Icon = Square
  return (
    <Button
      {...props}
      type={cancelling ? 'button' : 'submit'}
      size="icon"
      data-send-button
      className={cn('send-button', className)}
      aria-label={label}
      title={label}
      disabled={cancelling ? false : disabled || busy}
      onClick={cancelling ? onCancel : props.onClick}
    >
      <Icon aria-hidden="true" />
    </Button>
  )
}
