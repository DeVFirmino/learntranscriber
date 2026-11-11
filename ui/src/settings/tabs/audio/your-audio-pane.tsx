import { useT } from '@/use-t'
import type { Settings } from '@/bridge/types/settings'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsIcon } from '../../settings-icon'
import { useSettingsT } from '../../use-settings-t'
import type { Device } from './audio-sources'
import { MicrophoneTest } from './microphone-test'
import './audio-device-panel.css'

// Your Audio: one card with the microphone in use and a menu to change it, then the level meter and its test.
export function YourAudioPane({
  settings,
  failure = '',
  recording = false,
  level = 0,
  inputs,
  loading,
  inputName,
  onChoose,
}: {
  failure?: string
  recording?: boolean
  level?: number
  settings: Settings
  inputs: Device[]
  loading: boolean
  inputName: (id: string) => string
  onChoose: (microphoneId: string) => void
}) {
  const { st } = useSettingsT()
  const { t } = useT()
  const current = settings.microphoneId
  const available = current === 'default' || inputs.some((input) => input.deviceId === current)
  const label = (device: Device) =>
    device.label || st('settings.audio.microphoneFallback', { id: device.deviceId.slice(0, 8) })
  return (
    <div className="audio-device-panel" data-unavailable={available ? undefined : true}>
      <Item className="p-0">
        <ItemMedia className="audio-device-tile">
          <SettingsIcon name="mic" />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle>{st('settings.audio.tabs.your', 'Your Audio')}</ItemTitle>
          <ItemDescription className="audio-device-status">
            {available ? <SettingsIcon name="check_circle" className="audio-device-check" /> : null}
            {t(available ? 'audio.microphoneSelected' : 'audio.microphoneUnavailable')}
          </ItemDescription>
        </ItemContent>
      </Item>
      <Select value={current} onValueChange={onChoose} disabled={loading || recording}>
        <SelectTrigger className="audio-device-select" aria-label={st('settings.audio.chooseDevice', 'Choose device')}>
          <SelectValue
            placeholder={loading ? st('settings.audio.loadingDevices', 'Loading devices...') : inputName(current)}
          />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          <SelectItem value="default">{st('settings.audio.defaultMicrophone', 'Default Microphone')}</SelectItem>
          {inputs.map((device) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {label(device)}
            </SelectItem>
          ))}
          {available || loading ? null : (
            <SelectItem value={current} disabled>
              {inputName(current)}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      {recording ? <p className="setting-description">{t('audio.stopBeforeChangingInput')}</p> : null}
      {failure ? (
        <p role="alert" className="setting-description">
          {failure}
        </p>
      ) : null}
      <MicrophoneTest key={`${current}:${recording}`} deviceId={current} recording={recording} liveLevel={level} />
    </div>
  )
}
