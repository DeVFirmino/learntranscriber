import { RefreshCw } from 'lucide-react'
import { BrandScreen } from '@/components/brand-icon'
import { RadioGroup } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { PreferenceField } from '@/components/ui/preference-field'
import { ChoiceTile } from '@/components/ui/choice-tile'
import { useT } from '@/use-t'
import type { DisplayInfo } from '@/bridge/types/context'
import { useSettingsT } from '../../use-settings-t'
import '../../shared-choice-layout.css'

export function DisplayPane({
  displays,
  displayId,
  onRefresh,
  onChoose,
}: {
  displays: DisplayInfo[]
  displayId: string
  onRefresh: () => void
  onChoose: (displayId: string) => void
}) {
  const { st } = useSettingsT()
  const { t } = useT()
  return (
    <PreferenceField
      id="capture-display"
      icon={<BrandScreen />}
      title={st('settings.audio.displayCapture.title')}
      description={st('settings.audio.displayCapture.description')}
    >
      <div className="shared-choice-toolbar">
        <span>{st('settings.audio.displayCapture.selectDisplay')}</span>
        <Button variant="outline" size="icon-sm" aria-label={t('settingsPage.refreshDisplays')} onClick={onRefresh}>
          <RefreshCw aria-hidden="true" />
        </Button>
      </div>
      <RadioGroup.Root
        className="shared-choice-grid"
        aria-labelledby="capture-display-label"
        aria-describedby="capture-display-description"
        value={displayId}
        onValueChange={onChoose}
      >
        {displays.map((display) => (
          <ChoiceTile
            key={display.id}
            value={String(display.id)}
            label={display.label || `Display ${display.id}`}
            icon={<BrandScreen />}
          >
            <span className="shared-display-preview">
              <BrandScreen />
            </span>
          </ChoiceTile>
        ))}
      </RadioGroup.Root>
    </PreferenceField>
  )
}
