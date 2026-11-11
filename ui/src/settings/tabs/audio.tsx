import { useEffect, useState } from 'react'
import { SegmentedTabsList } from '@/components/ui/segmented-tabs'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import type { Settings } from '@/bridge/types/settings'
import { incomingChoice, incomingSettings } from '@/audio/incoming-choice'
import { useWorkspace } from '@/workspace'
import { SettingsIcon } from '../settings-icon'
import type { SettingsIconName } from '../icons/glyphs'
import { useSettingsT } from '../use-settings-t'
import { microphoneInputs } from './audio/audio-sources'
import { DisplayPane } from './audio/display-pane'
import { IncomingAudioPane } from './audio/incoming-audio-pane'
import { useAudioDevices } from './audio/use-audio-devices'
import { YourAudioPane } from './audio/your-audio-pane'

type Pane = 'your' | 'incoming' | 'display'

// Audio & Screen (1860): Your Audio, Incoming Audio and, with more than one display, Display. Each list's open state
// stays while another pane shows.
export function AudioTab() {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const [pane, setPane] = useState<Pane>('your')
  const { devices, displays, tapSupported, refreshDisplays } = useAudioDevices()
  const [levels, setLevels] = useState({ me: 0, they: 0 })
  useEffect(() => ws.api.onAudioLevels(setLevels), [ws.api])
  const settings = ws.state?.settings
  if (!settings) return null
  const loading = devices === null
  const inputs = microphoneInputs(devices)
  const inputName = (id: string) =>
    id === 'default'
      ? st('settings.audio.defaultMicrophone', 'Default Microphone')
      : inputs.find((device) => device.deviceId === id)?.label || id.slice(0, 20)
  const save = (patch: Partial<Settings>) =>
    void ws.act(async () => {
      await ws.api.settings(patch)
    })
  const chooseIncoming = (next: string) =>
    void ws.act(async () => {
      const patch = incomingSettings(next, settings)
      await ws.api.settings(patch)
      // A new source applies to a running recording without stopping it.
      if (ws.audio.recording) await ws.audio.switchIncoming({ ...settings, ...patch })
    })
  const tabs: { id: Pane; icon: SettingsIconName; name: string }[] = [
    { id: 'your', icon: 'mic', name: st('settings.audio.tabs.your', 'Your Audio') },
    { id: 'incoming', icon: 'headset_mic', name: st('settings.audio.tabs.incoming', 'Incoming Audio') },
    ...(displays.length > 1
      ? [
          {
            id: 'display' as const,
            icon: 'desktop_windows' as const,
            name: st('settings.audio.tabs.display', 'Display'),
          },
        ]
      : []),
  ]
  const shown = pane === 'display' && displays.length <= 1 ? 'your' : pane
  return (
    <Tabs className="audio-tab-container gap-5" value={shown} onValueChange={(next) => setPane(next as Pane)}>
      <SegmentedTabsList
        value={shown}
        label={st('settings.audio.sources')}
        segments={tabs.map((tab) => ({
          value: tab.id,
          label: (
            <span className="inline-flex items-center gap-2">
              <SettingsIcon name={tab.icon} />
              {tab.name}
            </span>
          ),
        }))}
      />
      <TabsContent value="your">
        <YourAudioPane
          settings={settings}
          recording={ws.audio.recording}
          level={levels.me}
          failure={ws.audio.failure}
          inputs={inputs}
          loading={loading}
          inputName={inputName}
          onChoose={(microphoneId) => save({ microphoneId })}
        />
      </TabsContent>
      <TabsContent value="incoming">
        <IncomingAudioPane
          choice={incomingChoice(settings)}
          level={levels.they}
          error={ws.audio.incomingError}
          supported={ws.state?.privacy.platform === 'darwin'}
          inputs={inputs}
          loading={loading}
          recording={ws.audio.recording}
          tapSupported={tapSupported}
          inputName={inputName}
          onChoose={chooseIncoming}
        />
      </TabsContent>
      <TabsContent value="display">
        <DisplayPane
          displays={displays}
          displayId={settings.displayId}
          onRefresh={refreshDisplays}
          onChoose={(displayId) => save({ displayId })}
        />
      </TabsContent>
    </Tabs>
  )
}
