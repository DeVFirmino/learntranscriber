import type { ComponentProps, ReactNode } from 'react'
import { Check } from 'lucide-react'
import { RadioGroup } from 'radix-ui'
import './choice-tile.css'

export function ChoiceTile({
  label,
  icon,
  children,
  className = '',
  ...props
}: Omit<ComponentProps<typeof RadioGroup.Item>, 'children'> & {
  label: string
  icon?: ReactNode
  children?: ReactNode
}) {
  return (
    <RadioGroup.Item {...props} aria-label={label} className={`choice-tile ${className}`}>
      {children ? (
        <span className="choice-tile-preview" aria-hidden="true">
          {children}
        </span>
      ) : null}
      <span className="choice-tile-caption">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        <span>{label}</span>
        <RadioGroup.Indicator className="choice-tile-indicator">
          <Check aria-hidden="true" />
        </RadioGroup.Indicator>
      </span>
    </RadioGroup.Item>
  )
}
