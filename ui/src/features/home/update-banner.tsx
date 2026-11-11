import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import type { UpdateStatus } from '@/bridge/types/updates'
import { Actions } from '@/components/chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { updateBannerView } from './update-banner-state'

// A newer build on GitHub Releases, read once on mount and then kept current from the main process. Download opens
// the release page, Later hides it for at least a day, Skip never shows that exact tag again.
export function UpdateBanner() {
  const ws = useWorkspace()
  const { t } = useT()
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  useEffect(() => {
    let alive = true
    void ws.api.updatesState().then((value) => {
      if (alive) setStatus(value)
    })
    const unsubscribe = ws.api.onUpdatesChange((value) => {
      if (alive) setStatus(value)
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [ws.api])
  const view = updateBannerView(status)
  if (!view.visible || !status) return null
  return (
    <Card className="home-reveal">
      <CardContent className="grid gap-4">
        <Item className="p-0">
          <ItemMedia className="home-tile">
            <Download aria-hidden="true" className="size-5 text-primary" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{t('home.updateTitle')}</ItemTitle>
            <ItemDescription>{t('home.updateDescription', { version: view.version })}</ItemDescription>
          </ItemContent>
        </Item>
        <Actions>
          <Button onClick={() => void ws.act(() => ws.api.openUpdate().then(() => undefined))}>
            {t('home.updateDownload')}
          </Button>
          <Button variant="outline" onClick={() => void ws.act(() => ws.api.laterUpdate().then(setStatus))}>
            {t('home.updateLater')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void ws.act(() => ws.api.skipUpdate(status.tagName ?? '').then(setStatus))}
          >
            {t('home.updateSkip')}
          </Button>
        </Actions>
      </CardContent>
    </Card>
  )
}
