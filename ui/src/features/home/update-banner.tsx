import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import type { UpdateStatus } from '@/bridge/types/updates'
import { Actions } from '@/components/chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Progress } from '@/components/ui/progress'
import { localizeMessage } from '@/format'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { updateBannerView } from './update-banner-state'

// A newer build on GitHub Releases, read once on mount and then kept current from the main process. Download saves
// the DMG to Downloads and keeps it only when its SHA-256 matches the release's checksum; Open installer then shows
// the DMG, where the person drags the app to Applications. What's new opens the release page, Later hides the banner
// for at least a day, and Skip never shows that exact tag again.
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
  const description =
    view.phase === 'downloading'
      ? view.percent === null
        ? t('home.updateDownloading', { version: view.version })
        : t('home.updateDownloadingPercent', { version: view.version, percent: String(view.percent) })
      : view.phase === 'ready'
        ? t('home.updateReady', { version: view.version })
        : view.phase === 'failed' && view.error
          ? localizeMessage(view.error)
          : t('home.updateDescription', { version: view.version })
  const download = () => void ws.act(() => ws.api.downloadUpdate().then(setStatus))
  const notes = (
    <Button variant="ghost" onClick={() => void ws.act(() => ws.api.openUpdate().then(() => undefined))}>
      {t('home.updateNotes')}
    </Button>
  )
  return (
    <Card className="home-reveal">
      <CardContent className="grid gap-4">
        <Item className="p-0">
          <ItemMedia className="home-tile">
            <Download aria-hidden="true" className="size-5 text-primary" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{t('home.updateTitle')}</ItemTitle>
            <ItemDescription role={view.phase === 'failed' ? 'alert' : 'status'}>{description}</ItemDescription>
          </ItemContent>
        </Item>
        {view.phase === 'downloading' ? (
          <Progress value={view.percent ?? 0} aria-label={description} />
        ) : (
          <Actions>
            {view.phase === 'ready' ? (
              <Button onClick={() => void ws.act(() => ws.api.installUpdate().then(() => undefined))}>
                {t('home.updateInstall')}
              </Button>
            ) : (
              <Button onClick={download}>
                {t(view.phase === 'failed' ? 'home.updateRetry' : 'home.updateDownload')}
              </Button>
            )}
            {notes}
            <Button variant="outline" onClick={() => void ws.act(() => ws.api.laterUpdate().then(setStatus))}>
              {t('home.updateLater')}
            </Button>
            {view.phase === 'ready' ? null : (
              <Button
                variant="ghost"
                onClick={() => void ws.act(() => ws.api.skipUpdate(status.tagName ?? '').then(setStatus))}
              >
                {t('home.updateSkip')}
              </Button>
            )}
          </Actions>
        )}
      </CardContent>
    </Card>
  )
}
