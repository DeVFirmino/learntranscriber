import { useMemo, useState } from 'react'
import { useWorkspace } from '@/workspace'
import { formatBytes } from '../local-model-info'
import { useSettingsT } from '../use-settings-t'
import { SettingsIcon } from '../settings-icon'
import { AnalysisPane } from './local/analysis-pane'
import type { Kind } from './local/model-list'
import { WhisperPane } from './local/whisper-pane'

// Local Models (6862 case "local"): the Transcriptions/Analysis panes and the downloads summary.
export function LocalModelsPage() {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const [pane, setPane] = useState<'whisper' | 'analyzer'>('whisper')
  const [downloading, setDownloading] = useState<Record<Kind, string | null>>({ whisper: null, llm: null })
  const state = ws.state
  const removable = useMemo(() => {
    if (!state) return []
    const local = state.localModels
    const keep = (['whisper', 'llm'] as Kind[]).map((kind) => {
      const available = local.models.filter((model) => model.kind === kind && model.available)
      return (available.find((model) => model.id === local.runtimes[kind]?.modelId) || available[0])?.id
    })
    return local.models.filter(
      (model) =>
        !keep.includes(model.id) &&
        (local.runtimes[model.kind]?.status ?? 'stopped') === 'stopped' &&
        !local.operations.some((item) => item.kind === model.kind),
    )
  }, [state])
  if (!state) return null
  const local = state.localModels
  const downloaded = local.models.filter((model) => model.available)
  const total = downloaded.reduce(
    (sum, model) => sum + model.bytes + (model.projectorAvailable ? model.projector?.bytes || 0 : 0),
    0,
  )
  const download = (kind: Kind) => (id: string) => {
    setDownloading((value) => ({ ...value, [kind]: id }))
    void ws.act(() => ws.api.downloadCatalog(id).then(() => undefined))
  }
  const running = local.runtimes.llm?.status === 'running'
  return (
    <>
      <div className="setting-group compact">
        <div className="local-provider-content">
          <div className="local-settings-tabs" role="tablist" aria-label={st('settings.api.providers.localName')}>
            <button
              type="button"
              role="tab"
              id="local-settings-tab-transcriptions"
              className={`local-settings-tab ${pane === 'whisper' ? 'active' : ''}`}
              aria-selected={pane === 'whisper'}
              aria-controls="local-settings-panel-transcriptions"
              onClick={() => setPane('whisper')}
            >
              <SettingsIcon name="record_voice_over" />
              <span>{st('settings.api.localModels.transcriptionsTab')}</span>
            </button>
            <button
              type="button"
              role="tab"
              id="local-settings-tab-analysis"
              className={`local-settings-tab ${pane === 'analyzer' ? 'active' : ''}`}
              aria-selected={pane === 'analyzer'}
              aria-controls="local-settings-panel-analysis"
              onClick={() => setPane('analyzer')}
            >
              <SettingsIcon name="auto_awesome" />
              <span>{st('settings.api.localModels.analysisTab')}</span>
            </button>
          </div>
          {pane === 'whisper' ? (
            <div
              id="local-settings-panel-transcriptions"
              role="tabpanel"
              aria-labelledby="local-settings-tab-transcriptions"
              className="local-model-settings-panel"
            >
              <WhisperPane downloading={downloading.whisper} onDownload={download('whisper')} />
            </div>
          ) : (
            <div
              id="local-settings-panel-analysis"
              role="tabpanel"
              aria-labelledby="local-settings-tab-analysis"
              className="local-model-settings-panel"
            >
              <AnalysisPane downloading={downloading.llm} onDownload={download('llm')} />
            </div>
          )}
        </div>
      </div>
      <div className="local-models-maintenance-card">
        <div className="local-models-maintenance-copy">
          <div className="local-models-maintenance-title">
            {st('settings.api.localModels.downloadsSummary', { amount: formatBytes(total), count: downloaded.length })}
          </div>
          <div className="local-models-maintenance-desc">{st('settings.api.localModels.cleanupUnusedDescription')}</div>
        </div>
        <div className="local-models-maintenance-actions">
          {running ? (
            <span className="local-models-overview-status-pill">
              {st('settings.api.localModels.overviewStatusRunning')}
            </span>
          ) : null}
          <button
            className="glass-button-small local-models-overview-settings-button"
            disabled={!removable.length}
            aria-label={st('settings.api.localModels.cleanupUnused')}
            onClick={() =>
              void ws.act(async () => {
                if (!window.confirm(st('settings.api.localModels.cleanupConfirm'))) return
                for (const model of removable) await ws.api.removeLocalModel(model.id)
              })
            }
          >
            <SettingsIcon name="delete_sweep" />
            <span>{st('settings.api.localModels.cleanupUnused')}</span>
          </button>
        </div>
      </div>
    </>
  )
}
