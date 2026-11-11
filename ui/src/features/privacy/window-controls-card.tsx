import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OverlayOpacity } from '@/components/overlay-opacity'
import { SettingRow } from '@/components/chrome'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { Toggle } from './toggle'

// Window controls card: capture/dock hiding (forced on by stealth mode), how the floating assistant opens and stays,
// and its opacity.
export function WindowControlsCard() {
  const ws = useWorkspace()
  const { t } = useT()
  if (!ws.state) return null
  const opacity = Math.round(ws.state.settings.overlayOpacity * 100)
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{t('privacy.windowControls')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Toggle
          name="captureProtection"
          disabled={ws.state.settings.stealthMode}
          effective={ws.state.settings.stealthMode ? true : undefined}
          title={t('privacy.protection')}
          description={t('privacy.protectionHint')}
        />
        <Toggle
          name="hideDock"
          disabled={ws.state.settings.stealthMode}
          effective={ws.state.settings.stealthMode ? true : undefined}
          title={t('privacy.hideDock')}
          description={t('privacy.hideDockHint')}
        />
        <Toggle
          name="launchFloating"
          title={t('privacy.launchFloating')}
          description={t('privacy.launchFloatingHint')}
        />
        <Toggle name="overlayOnTop" title={t('privacy.onTop')} description={t('privacy.onTopHint')} />
        <SettingRow title={t('privacy.opacity')} description={t('privacy.opacityHint')}>
          <OverlayOpacity value={opacity} />
        </SettingRow>
      </CardContent>
    </Card>
  )
}
