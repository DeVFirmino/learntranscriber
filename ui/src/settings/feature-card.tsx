import type { ReactNode } from 'react'
import { SettingsIcon } from './settings-icon'
import type { SettingsIconName } from './icons/glyphs'

// The settings card shell the Behavior and Permissions pages share: illustration, icon + title row, an optional control
// on the right (a toggle, a status), a description and extra content.
export function FeatureCard({
  art,
  icon,
  title,
  control,
  description,
  children,
}: {
  art: ReactNode
  icon: SettingsIconName
  title: string
  control?: ReactNode
  description: string
  children?: ReactNode
}) {
  return (
    <div className="feature-grid-card glass-panel-medium">
      <div className="feature-grid-card-illustration">{art}</div>
      <div className="feature-grid-card-body">
        <div className="feature-grid-card-row">
          <div className="feature-grid-card-info">
            <SettingsIcon name={icon} className="feature-grid-card-icon" style={{ pointerEvents: 'none' }} />
            <span className="feature-grid-card-title">{title}</span>
          </div>
          {control}
        </div>
        <p className="feature-grid-card-desc">{description}</p>
        {children}
      </div>
    </div>
  )
}
