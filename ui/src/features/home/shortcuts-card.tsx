import type { PublicState } from '@/bridge/types/state'
import { ShortcutKeys } from '@/components/shortcut-keys'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MessageKey } from '@/i18n'
import { useT } from '@/use-t'
import { homeShortcuts } from './home-overview'

// The keys a session starts with, as they are bound now, and the way to the full list.
export function ShortcutsCard({ state }: { state: PublicState }) {
  const { t } = useT()
  const shortcuts = homeShortcuts(state.shortcutDefinitions)
  if (!shortcuts.length) return null
  return (
    <Card className="home-reveal">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('home.shortcuts')}</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <a href="#settings/features/shortcuts">{t('home.allShortcuts')}</a>
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="home-shortcuts">
          {shortcuts.map((item) => (
            <li key={item.id}>
              <span className="min-w-0 truncate">{t(`shortcut.${item.id}` as MessageKey)}</span>
              <ShortcutKeys accelerator={item.accelerator} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
