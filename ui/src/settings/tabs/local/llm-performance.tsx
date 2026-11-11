import { Collapsible } from 'radix-ui'
import { ChevronDown } from 'lucide-react'
import '../../advanced-preferences.css'
import { recommendedPreset } from '../../local-presets'
import { launchOf, type Tuning } from '../../local-launch'
import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'
import { LlmPreset } from './llm-preset'
import { LlmTuningPanel } from './llm-tuning-panel'
import type { LocalLaunch } from './use-local-launch'

const BADGE_KEYS = {
  running: 'settings.api.localModels.launchConfigActive',
  custom: 'settings.api.localModels.launchConfigCustom',
  default: 'settings.api.localModels.launchConfigDefault',
}

function launchBadge(running: boolean, saved: boolean): keyof typeof BADGE_KEYS {
  if (running) return 'running'
  if (saved) return 'custom'
  return 'default'
}

// The server's launch values and how to change them: a performance preset, a recommendation when Fast suits this
// Mac, the manual tuning panel, and a tip to use a cloud model when the local one is small.
export function LlmPerformance({
  launch,
  tuning,
  onTuning,
  draft,
  onDraft,
}: {
  launch: LocalLaunch
  tuning: boolean
  onTuning: (change: (value: boolean) => boolean) => void
  draft: Tuning
  onDraft: (change: (value: Tuning) => Tuning) => void
}) {
  const { st } = useSettingsT()
  const { local, runtime, running, starting, busy, saved, shown } = launch
  const autoTuned = Boolean(runtime?.tuning?.autoTuned)
  const recommended = recommendedPreset(local.system)
  const memoryGb = local.system?.totalMemoryBytes ? local.system.totalMemoryBytes / 1024 ** 3 : null
  const badge = launchBadge(running, Boolean(saved))
  return (
    <div className="local-preview-expanded">
      <div className="local-llm-server-card">
        <LlmPreset
          launch={launch}
          autoTuned={autoTuned}
          recommended={recommended}
          onCustom={() => onTuning(() => true)}
        />
        <Collapsible.Root open={tuning} onOpenChange={(open) => onTuning(() => open)} className="advanced-preferences">
          <div className="local-llm-tuning-actions-row">
            <Collapsible.Trigger asChild>
              <button
                className="glass-button-small local-llm-tuning-toggle"
                aria-expanded={tuning}
                aria-controls="local-performance-advanced"
              >
                <SettingsIcon name="tune" />
                <span>
                  {st(tuning ? 'settings.api.localModels.hideTuning' : 'settings.api.localModels.showTuning')}
                </span>
                <ChevronDown aria-hidden="true" className="advanced-chevron" />
              </button>
            </Collapsible.Trigger>
            {saved ? (
              <button
                className="glass-button-small local-llm-tuning-reset"
                onClick={() => launch.launch({ clear: true })}
                disabled={busy || starting}
              >
                <SettingsIcon name="delete" />
                <span>{st('settings.api.localModels.clearPreferences')}</span>
              </button>
            ) : null}
          </div>
          {tuning ? (
            <Collapsible.Content id="local-performance-advanced" className="advanced-preferences-content">
              <div className="local-llm-server-metrics">
                <div className="local-llm-server-metric">
                  <div className="local-llm-server-metric-label">
                    {st('settings.api.localModels.launchConfigTitle')}
                    <span className={`local-llm-server-metric-badge ${badge}`}>{st(BADGE_KEYS[badge])}</span>
                  </div>
                  <div className="local-llm-server-metric-value">
                    {st('settings.api.localModels.launchConfigValue', {
                      ctx: shown.localContextSize,
                      gpu: shown.localGpuLayers,
                      batch: shown.localBatchSize,
                      ubatch: shown.localUbatchSize,
                      parallel: shown.localParallel,
                    })}
                  </div>
                  {autoTuned ? (
                    <div className="local-llm-server-metric-hint">{st('settings.api.localModels.autoTunedHint')}</div>
                  ) : null}
                </div>
              </div>
              <LlmTuningPanel
                draft={draft}
                onDraft={onDraft}
                onSave={() => launch.launch({ settings: launchOf(draft), restart: running })}
                disabled={busy || starting}
              />
            </Collapsible.Content>
          ) : null}
        </Collapsible.Root>
        {autoTuned || shown.localContextSize <= 2048 || (memoryGb != null && memoryGb < 10) ? (
          <div className="local-llm-cloud-tip">
            <SettingsIcon name="cloud" />
            <span>{st('settings.api.localModels.cloudRecommendation')}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
// keys: settings.api.localModels.launchConfigActive settings.api.localModels.launchConfigCustom
// keys: settings.api.localModels.launchConfigDefault
// keys: settings.api.localModels.hideTuning settings.api.localModels.showTuning
