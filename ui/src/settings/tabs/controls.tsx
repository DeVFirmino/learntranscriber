import { ChevronDown } from 'lucide-react'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { FeaturesTab } from './features'
import { ShortcutsTab } from './shortcuts'
import './controls.css'

export function ControlsTab() {
  const { t } = useT()
  const ws = useWorkspace()
  const shortcuts = ws.route.endsWith('/shortcuts')
  return (
    <div className="controls-sections">
      <details key={`behavior-${shortcuts}`} open={!shortcuts}>
        <summary>
          <span>
            <strong>{t('controls.behavior')}</strong>
            <small>{t('controls.behaviorHint')}</small>
          </span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className="controls-section-content">
          <FeaturesTab />
        </div>
      </details>
      <details key={`shortcuts-${shortcuts}`} open={shortcuts}>
        <summary>
          <span>
            <strong>{t('nav.shortcuts')}</strong>
            <small>{t('controls.shortcutsHint')}</small>
          </span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className="controls-section-content">
          <ShortcutsTab />
        </div>
      </details>
    </div>
  )
}
