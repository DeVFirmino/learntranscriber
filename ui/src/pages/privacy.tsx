import { Button } from '@/components/ui/button'
import { PageHeading } from '@/components/chrome'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { StealthCard } from '@/features/privacy/stealth-card'
import { WindowControlsCard } from '@/features/privacy/window-controls-card'
import '@/features/control-page.css'
import '@/features/privacy/privacy-layout.css'

// Privacy settings page: the hide-now action, stealth mode and the window controls, side by side.
export function Privacy() {
  const ws = useWorkspace()
  const { t } = useT()
  if (!ws.state) return null
  return (
    <div className="control-page privacy-page">
      <PageHeading title={t('settings.privacyLink')} description={t('privacy.description')}>
        <Button onClick={() => void ws.act(() => ws.api.hide().then(() => undefined))}>{t('privacy.hideNow')}</Button>
      </PageHeading>
      <div className="control-page-columns">
        <div className="control-page-column">
          <StealthCard />
        </div>
        <div className="control-page-column">
          <WindowControlsCard />
        </div>
      </div>
    </div>
  )
}
