import type { ComponentProps } from 'react'
import { cn } from 'cn'
import { Textarea } from './textarea'
import './input-group.css'

export function InputGroup({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} role="group" data-slot="input-group" className={cn('input-group', className)} />
}

export function InputGroupTextarea({ className, ...props }: ComponentProps<typeof Textarea>) {
  return <Textarea {...props} className={cn('input-group-control', className)} />
}

export function InputGroupAddon({
  align = 'block-end',
  className,
  ...props
}: ComponentProps<'div'> & { align?: 'block-start' | 'block-end' }) {
  return (
    <div {...props} data-slot="input-group-addon" data-align={align} className={cn('input-group-addon', className)} />
  )
}
