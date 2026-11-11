import { Gauge, ShieldCheck, Scale, Zap } from 'lucide-react'
import { RadioGroup } from 'radix-ui'
import { PreferenceField } from '@/components/ui/preference-field'
import { ChoiceTile } from '@/components/ui/choice-tile'
import '../../shared-choice-layout.css'
import { PRESETS, PRESET_NAMES, type Preset } from '../../local-presets'
import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'
import type { LocalLaunch } from './use-local-launch'

const PRESET_ICONS = { safe: ShieldCheck, balanced: Scale, fast: Zap }

const PRESET_KEYS: Record<Preset, string> = {
  safe: 'settings.api.localModels.performancePresetSafe',
  balanced: 'settings.api.localModels.performancePresetBalanced',
  fast: 'settings.api.localModels.performancePresetFast',
}

// The performance preset for the local server, with a note when Fast is the one this Mac should use.
// Choosing Custom opens the tuning panel instead.
export function LlmPreset({
  launch,
  autoTuned,
  recommended,
  onCustom,
}: {
  launch: LocalLaunch
  autoTuned: boolean
  recommended: Preset
  onCustom: () => void
}) {
  const { st } = useSettingsT()
  const { busy, starting, preset } = launch
  return (
    <>
      <PreferenceField
        id="local-performance"
        icon={<Gauge />}
        title={st('settings.api.localModels.performancePresetTitle')}
        description={st('settings.api.localModels.performancePresetDescription')}
      >
        <RadioGroup.Root
          className="shared-choice-grid"
          aria-labelledby="local-performance-label"
          aria-describedby="local-performance-description"
          value={preset}
          disabled={busy || starting}
          onValueChange={(value) => {
            if (value === 'custom') return onCustom()
            launch.launch({ settings: PRESETS[value as Preset] })
          }}
        >
          {PRESET_NAMES.map((name) => {
            const Icon = PRESET_ICONS[name]
            return <ChoiceTile value={name} key={name} label={st(PRESET_KEYS[name])} icon={<Icon />} />
          })}
          {preset === 'custom' ? (
            <ChoiceTile value="custom" label={st('settings.api.localModels.performancePresetCustom')} disabled />
          ) : null}
        </RadioGroup.Root>
      </PreferenceField>
      {!autoTuned && preset === 'fast' && recommended === 'fast' ? (
        <div className="local-llm-preset-note" role="note">
          <SettingsIcon name="info" />
          <div className="local-llm-preset-note-content">
            <div className="local-llm-preset-note-title">
              {st('settings.api.localModels.performancePresetRecommendationTitle', {
                preset: st(PRESET_KEYS.fast),
              })}
            </div>
            <div className="local-llm-preset-note-text">
              {st('settings.api.localModels.performancePresetFastRecommendationText', {
                preset: st(PRESET_KEYS.fast),
                balanced: st(PRESET_KEYS.balanced),
                safe: st(PRESET_KEYS.safe),
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
// keys: settings.api.localModels.performancePresetBalanced settings.api.localModels.performancePresetFast
// keys: settings.api.localModels.performancePresetSafe
