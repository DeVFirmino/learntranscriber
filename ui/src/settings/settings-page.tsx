import { lazy, Suspense } from 'react'
import { ChevronRight } from 'lucide-react'
import { PageHeading } from '@/components/chrome'
import { Privacy } from '@/pages/privacy'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { SETTINGS_SECTIONS, settingsSection } from '@/features/shell/navigation'
import { InterfacePreferences } from './tabs/profile/interface-preferences'
import { DataManagement } from './tabs/profile/data-management'
import './settings-scope.css'
import './settings-base.css'
import './settings-theme.css'
import './settings-layout.css'
import './settings-surfaces.css'
import './settings-embedded.css'

const AiSettings = lazy(() => import('./tabs/ai-settings').then((m) => ({ default: m.AiSettings })))
const AudioTab = lazy(() => import('./tabs/audio').then((m) => ({ default: m.AudioTab })))
const PermissionsTab = lazy(() => import('./tabs/permissions').then((m) => ({ default: m.PermissionsTab })))
const ControlsTab = lazy(() => import('./tabs/controls').then((m) => ({ default: m.ControlsTab })))

export function SettingsPage() {
  const ws = useWorkspace()
  const { t } = useT()
  const section = settingsSection(ws.route)
  const label = SETTINGS_SECTIONS.find(([id]) => id === section)?.[1] || 'nav.general'
  const description = `settingsPage.${section}` as const
  return (
    <div className="settings-screen" data-section={section}>
      <nav className="page-breadcrumb" aria-label={t('nav.location')}>
        <a href="#settings">{t('nav.settings')}</a>
        <ChevronRight aria-hidden="true" className="size-3.5" />
        <span aria-current="page">{t(label)}</span>
      </nav>
      {section === 'privacy' ? null : <PageHeading title={t(label)} description={t(description)} />}
      {section === 'privacy' ? (
        <Privacy />
      ) : (
        <div className="settings-scope settings-embedded">
          <div className="settings-container-standalone">
            <div className="settings-content">
              <Suspense
                fallback={
                  <p className="settings-loading" role="status">
                    {t('app.loading')}
                  </p>
                }
              >
                {section === 'general' ? (
                  <div className="grid gap-4">
                    <InterfacePreferences />
                    <AudioTab />
                  </div>
                ) : null}
                {section === 'data' ? (
                  <div className="grid gap-6">
                    <DataManagement />
                  </div>
                ) : null}
                {section === 'ai' ? <AiSettings /> : null}
                {section === 'permissions' ? <PermissionsTab /> : null}
                {section === 'features' ? <ControlsTab /> : null}
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
