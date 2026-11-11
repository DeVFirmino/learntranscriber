import { ShieldOff } from 'lucide-react'
import { BrandPrivacy } from '@/components/brand-icon'
import type { PublicState } from '@/bridge/types/state'
import { Actions } from '@/components/chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'

// Whether capture protection is on, the privacy controls, and hiding every window.
export function PrivacyCard({ state }: { state: PublicState }) {
  const ws = useWorkspace()
  const { t } = useT()
  const protectedNow = state.settings.captureProtection
  const Shield = protectedNow ? BrandPrivacy : ShieldOff
  return (
    <Card className="home-reveal">
      <CardContent className="grid gap-4">
        <Item className="p-0">
          <ItemMedia className="home-tile">
            <Shield aria-hidden="true" className="size-5 text-primary" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{t('settings.privacyLink')}</ItemTitle>
            <ItemDescription>{protectedNow ? t('home.protectionOn') : t('home.protectionOff')}</ItemDescription>
          </ItemContent>
        </Item>
        <Actions>
          <Button variant="outline" asChild>
            <a href="#settings/privacy">{t('home.privacyControls')}</a>
          </Button>
          <Button variant="outline" onClick={() => void ws.act(() => ws.api.hide().then(() => undefined))}>
            {t('home.hideAll')}
          </Button>
        </Actions>
      </CardContent>
    </Card>
  )
}
