import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { displayKeys } from '@/features/shortcut-display'
import { Toggle } from './toggle'

// Stealth mode card: the capture-hiding toggle, plus the menu bar icon toggle and its fallback note.
export function StealthCard() {
  const ws = useWorkspace()
  const { t } = useT()
  if (!ws.state) return null
  const restoreKey = displayKeys(ws.state.privacy.shortcuts.hide).join('') || t('privacy.restoreFallback')
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{t('privacy.stealth')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Toggle name="stealthMode" title={t('privacy.stealthEnable')} description={t('privacy.stealthHint')} />
        <Toggle
          name="showMenuBarIcon"
          title={t('privacy.menuIcon')}
          description={t('privacy.menuIconHint', { shortcut: restoreKey })}
        />
        {ws.state.privacy.menuBarRecoveryFallback ? (
          <p className="py-3 text-sm text-muted-foreground">{t('privacy.menuFallback')}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
