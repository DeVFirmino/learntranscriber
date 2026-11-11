import { Toggle } from '../../controls'
import type { Tuning } from '../../local-launch'
import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'

// The manual launch values: warm-up, context, parallel slots, GPU layers and batch sizes, saved together.
export function LlmTuningPanel({
  draft,
  onDraft,
  onSave,
  disabled,
}: {
  draft: Tuning
  onDraft: (change: (value: Tuning) => Tuning) => void
  onSave: () => void
  disabled: boolean
}) {
  const { st } = useSettingsT()
  const field = (
    key: keyof Omit<Tuning, 'warmup'>,
    label: string,
    bounds: { min: number; max?: number; step: number },
  ) => (
    <div className="local-llm-tuning-field">
      <label className="local-llm-tuning-label">{st(label)}</label>
      <input
        type="number"
        className="custom-input local-llm-tuning-input"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={draft[key]}
        onChange={(event) => onDraft((value) => ({ ...value, [key]: event.target.value }))}
      />
    </div>
  )
  return (
    <div className="local-llm-tuning-panel">
      <div className="local-llm-autostart-row">
        <div className="local-llm-autostart-text">
          <div className="local-llm-autostart-title">{st('settings.api.localModels.warmupTitle')}</div>
          <div className="local-llm-autostart-desc">{st('settings.api.localModels.warmupDescription')}</div>
        </div>
        <Toggle checked={draft.warmup} onChange={(checked) => onDraft((value) => ({ ...value, warmup: checked }))} />
      </div>
      <div className="local-llm-tuning-grid">
        {field('ctxSize', 'settings.api.localModels.ctxSizeLabel', { min: 512, step: 256 })}
        {field('parallel', 'settings.api.localModels.parallelLabel', { min: 1, max: 16, step: 1 })}
        {field('gpuLayers', 'settings.api.localModels.gpuLayersLabel', { min: 0, max: 99, step: 1 })}
        {field('batchSize', 'settings.api.localModels.batchSizeLabel', { min: 1, max: 4096, step: 32 })}
        {field('ubatchSize', 'settings.api.localModels.ubatchSizeLabel', { min: 1, max: 4096, step: 32 })}
      </div>
      <div className="local-llm-tuning-actions-footer">
        <button className="glass-button-small local-llm-tuning-save" onClick={onSave} disabled={disabled}>
          <SettingsIcon name="save" />
          <span>{st('settings.api.localModels.saveAndRestart')}</span>
        </button>
        <div className="local-llm-tuning-note">{st('settings.api.localModels.tuningNote')}</div>
      </div>
    </div>
  )
}
// keys: settings.api.localModels.batchSizeLabel settings.api.localModels.ctxSizeLabel
// keys: settings.api.localModels.gpuLayersLabel settings.api.localModels.parallelLabel
// keys: settings.api.localModels.ubatchSizeLabel
