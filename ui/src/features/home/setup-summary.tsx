import type { ReactNode } from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import { BrandAudio, BrandListen } from '@/components/brand-icon'
import type { PublicState } from '@/bridge/types/state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { ProviderIcon } from '@/settings/settings-icon'
import { useT } from '@/use-t'
import { providerName, transcriptionName } from './home-overview'

// Once setup is done, what it is set to: the AI model, where speech becomes text, and what is heard. Each row opens
// the settings that change it.
export function SetupSummary({ state, onReview }: { state: PublicState; onReview: () => void }) {
  const { t } = useT()
  const { settings } = state
  const provider =
    providerName(settings.provider) ?? (settings.provider === 'local' ? t('home.localModel') : t('home.customProvider'))
  const rows: [string, ReactNode, string, string][] = [
    [
      t('home.setupModel'),
      providerName(settings.provider) ? (
        <ProviderIcon key="model" providerId={settings.provider} />
      ) : (
        <Sparkles key="model" aria-hidden="true" />
      ),
      `${provider} · ${settings.model || t('home.noModel')}`,
      '#settings/ai/sources',
    ],
    [
      t('home.setupTranscription'),
      <BrandAudio key="transcription" aria-hidden="true" />,
      transcriptionName(settings) ?? t('home.customProvider'),
      '#settings/ai/models',
    ],
    [
      t('home.setupAudio'),
      <BrandListen key="audio" aria-hidden="true" />,
      settings.systemAudio ? t('home.audioComputer') : t('home.audioMic'),
      '#settings/general',
    ],
  ]
  return (
    <Card className="home-reveal">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('home.yourSetup')}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onReview}>
          {t('home.review')}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-1">
        {rows.map(([label, icon, value, route]) => (
          <Item key={label} size="sm" asChild className="home-setup-row">
            <a href={route}>
              <ItemMedia className="home-tile home-tile-sm text-primary">{icon}</ItemMedia>
              <ItemContent className="min-w-0">
                <ItemDescription className="text-xs">{label}</ItemDescription>
                <ItemTitle className="w-full">
                  <span className="truncate">{value}</span>
                </ItemTitle>
              </ItemContent>
              <ItemActions>
                <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
              </ItemActions>
            </a>
          </Item>
        ))}
      </CardContent>
    </Card>
  )
}
