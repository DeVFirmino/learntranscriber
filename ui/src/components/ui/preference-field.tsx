import type { ReactNode } from 'react'
import './preference-field.css'

export function PreferenceField({
  id,
  icon,
  title,
  description,
  children,
}: {
  id: string
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="preference-field" aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`}>
      <div className="preference-field-heading">
        <span className="preference-field-icon" aria-hidden="true">
          {icon}
        </span>
        <h4 id={`${id}-label`}>{title}</h4>
      </div>
      <p id={`${id}-description`}>{description}</p>
      <div className="preference-field-control">{children}</div>
    </section>
  )
}
