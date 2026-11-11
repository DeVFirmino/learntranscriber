import type { CSSProperties } from 'react'
import type { Settings } from '@/bridge/types/settings'
import { useWorkspace } from '@/workspace'
import { Toggle } from '../../controls'
import { formatBytes, infoOf } from '../../local-model-info'
import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'
import { ModelList } from './model-list'
import { RuntimeNote } from './runtime-note'
import { Stat } from './stat'

// The Transcriptions pane: the local Whisper engine's status, its GPU switch and its models.
export function WhisperPane({
  downloading,
  onDownload,
}: {
  downloading: string | null
  onDownload: (id: string) => void
}) {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const state = ws.state!
  const settings = state.settings as Settings & { localWhisperGpu?: boolean }
  const models = state.localModels.models.filter((model) => model.kind === 'whisper')
  const available = models.filter((model) => model.available)
  const runtime = state.localModels.runtimes.whisper
  const selected = available.find((model) => model.id === runtime?.modelId) || available[0]
  const storage = models.reduce((total, model) => total + (model.available ? model.bytes : 0), 0)
  const gpu = settings.localWhisperGpu ?? true
  return (
    <div className="local-transcription-engine-list">
      <section className="local-engine-card active">
        <div className="local-engine-card-header">
          <div className="local-engine-card-header-left">
            <div className="local-engine-card-icon" style={{ '--provider-accent': '#5ea4ff' } as CSSProperties}>
              <SettingsIcon name="model-whisper" />
            </div>
            <div className="local-engine-card-copy">
              <div className="local-engine-card-title">{st('settings.api.localModels.whisperHeaderTitle')}</div>
              <div className="local-engine-card-description">{st('settings.api.localModels.whisperSettingsDesc')}</div>
            </div>
          </div>
        </div>
        <div className="local-preview-status-row">
          <span className={`local-preview-status-pill ${selected ? 'ready' : 'neutral'}`}>
            {st(selected ? 'settings.api.localModels.statusReady' : 'settings.api.localModels.notConfigured')}
          </span>
        </div>
        <div className="local-preview-stats">
          <Stat
            label={st('settings.api.localModels.selected')}
            value={
              selected
                ? infoOf(selected, state.modelCatalog).name
                : st('settings.api.localModels.summaryNoModelSelected')
            }
          />
          <Stat label={st('settings.api.localModels.summaryDownloadedModels')} value={available.length} />
          <Stat
            label={st('settings.api.localModels.gpuLabel')}
            value={st(
              gpu ? 'settings.api.localModels.summaryGpuEnabled' : 'settings.api.localModels.summaryGpuDisabled',
            )}
          />
          <Stat label={st('settings.api.localModels.summaryStorage')} value={storage ? formatBytes(storage) : '—'} />
        </div>
        <div className="local-engine-card-details">
          {'localWhisperGpu' in settings ? (
            <div className="local-llm-server-card">
              <div className="local-llm-autostart-row">
                <div className="local-llm-autostart-text">
                  <div className="local-llm-autostart-title">{st('settings.api.localModels.whisperUseGpuTitle')}</div>
                  <div className="local-llm-autostart-desc">{st('settings.api.localModels.useGpuDescription')}</div>
                </div>
                <Toggle
                  checked={gpu}
                  className="local-transcription-setting-toggle whisper-gpu"
                  onChange={(checked) =>
                    void ws.act(async () => {
                      await ws.api.settings({ localWhisperGpu: checked } as Partial<Settings>)
                    })
                  }
                />
              </div>
            </div>
          ) : null}
          <RuntimeNote kind="whisper" />
          <div>
            <ModelList kind="whisper" downloading={downloading} onDownload={onDownload} />
          </div>
        </div>
      </section>
    </div>
  )
}
// keys: settings.api.localModels.notConfigured settings.api.localModels.statusReady
// keys: settings.api.localModels.summaryGpuDisabled settings.api.localModels.summaryGpuEnabled
