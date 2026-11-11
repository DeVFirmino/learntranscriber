import { useT } from '@/use-t'
import { INPUT } from '@/audio/incoming-choice'
import { Badge } from '@/components/ui/badge'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useWorkspace } from '@/workspace'
import { SettingsIcon } from '../../settings-icon'
import { useSettingsT } from '../../use-settings-t'
import { incomingIcon, type Device } from './audio-sources'
import { incomingOptions, type IncomingOption } from './incoming-options'
import { MeetingAudioGuide } from './meeting-audio-guide'
import './audio-device-panel.css'

// The macOS virtual audio drivers this app can route through; it ships none of its own.
const THIRD_PARTY = [
  { name: 'BlackHole', url: 'https://existential.audio/blackhole/' },
  { name: 'Loopback', url: 'https://rogueamoeba.com/loopback/' },
  { name: 'SoundSource', url: 'https://rogueamoeba.com/soundsource/' },
]

// Incoming Audio, in the same card as Your Audio: the chosen source with whether native capture exists here, a menu
// of every source, its level while active, then the third-party drivers and the meeting guide.
export function IncomingAudioPane({
  choice,
  error = '',
  supported = false,
  level = 0,
  inputs,
  loading,
  recording,
  tapSupported,
  inputName,
  onChoose,
}: {
  error?: string
  supported?: boolean
  level?: number
  choice: string
  inputs: Device[]
  loading: boolean
  recording: boolean
  tapSupported: boolean
  inputName: (id: string) => string
  onChoose: (choice: string) => void
}) {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const { t } = useT()
  const active = choice !== 'none'
  const { system, devices } = incomingOptions({ choice, inputs, tapSupported })
  const label = (option: IncomingOption) => {
    if ('device' in option)
      return option.device.label || st('settings.audio.microphoneFallback', { id: option.device.deviceId.slice(0, 8) })
    if (option.kind === 'none') return st('settings.audio.noneDisabled', 'None (Disabled)')
    if (option.kind === 'system-audio') return st('settings.audio.systemAudio.dropdownOption', 'System Audio (Native)')
    if (option.kind === 'native-tap') return t('audio.nativeTap')
    return st('settings.audio.defaultMicrophone', 'Default Microphone')
  }
  const known = [...system, ...devices].some((option) => option.value === choice)
  const description = () => {
    if (choice === 'native-tap' && recording)
      return st('settings.audio.systemCapturingDescription', 'Capturing meeting audio automatically')
    if (choice === 'system-audio') return st('settings.audio.systemAudio.description')
    return st('settings.audio.incomingAudioDescription')
  }
  return (
    <div className="audio-device-panel">
      <Item className="p-0">
        <ItemMedia className="audio-device-tile">
          <SettingsIcon name={incomingIcon(choice)} />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="flex-wrap">
            {st('settings.audio.tabs.incoming', 'Incoming Audio')}
            <Badge variant="outline" data-native={supported}>
              {t(supported ? 'audio.nativeAvailable' : 'audio.nativeUnavailable')}
            </Badge>
          </ItemTitle>
          <ItemDescription className="audio-device-status">
            {active ? <SettingsIcon name="check_circle" className="audio-device-check" /> : null}
            {description()}
          </ItemDescription>
        </ItemContent>
      </Item>
      <Select value={choice} onValueChange={onChoose} disabled={loading}>
        <SelectTrigger className="audio-device-select" aria-label={st('settings.audio.chooseSource', 'Choose source')}>
          <SelectValue placeholder={loading ? st('settings.audio.loadingDevices', 'Loading devices...') : undefined} />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          <SelectGroup>
            {system.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {label(option)}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            {devices.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {label(option)}
              </SelectItem>
            ))}
            {known || loading ? null : (
              <SelectItem value={choice} disabled>
                {inputName(choice.slice(INPUT.length))}
              </SelectItem>
            )}
          </SelectGroup>
        </SelectContent>
      </Select>
      {active ? (
        <div
          className="audio-meter"
          role="meter"
          aria-label={st('settings.audio.tabs.incoming', 'Incoming Audio')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level * 100)}
        >
          <div className="audio-meter-level" style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="setting-description">
          {error}
        </p>
      ) : null}
      <p className="microphone-test-hint">
        {supported ? t('audio.nativeWithoutDriver') : t('audio.nativeUnsupported')}{' '}
        {st('settings.audio.thirdPartyDrivers', 'Or use a third-party virtual audio driver:')}{' '}
        {THIRD_PARTY.map((app, index) => (
          <span key={app.name}>
            <button type="button" className="virtual-audio-link" onClick={() => void ws.api.openResponseLink(app.url)}>
              {app.name}
            </button>
            {index < THIRD_PARTY.length - 1 ? ', ' : ''}
          </span>
        ))}
      </p>
      <MeetingAudioGuide />
    </div>
  )
}
