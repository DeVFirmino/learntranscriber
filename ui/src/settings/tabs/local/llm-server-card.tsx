import { useWorkspace } from '@/workspace'
import { Toggle } from '../../controls'
import { formatBytes, infoOf } from '../../local-model-info'
import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'
import { LlmServerActions } from './llm-server-actions'
import { RuntimeNote } from './runtime-note'
import { Stat } from './stat'
import type { LocalLaunch } from './use-local-launch'

function serverStatus(starting: boolean, running: boolean) {
  if (starting) return 'starting'
  if (running) return 'running'
  return 'stopped'
}

function SwitchRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="local-llm-autostart-row">
      <div className="local-llm-autostart-text">
        <div className="local-llm-autostart-title">{title}</div>
        <div className="local-llm-autostart-desc">{description}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

// The local analysis server: what it runs, the disk, memory and compute it uses, starting it with the app, and the
// server buttons.
export function LlmServerCard({ launch }: { launch: LocalLaunch }) {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const { settings, local, runtime, running, starting, selected, shown, storage } = launch
  const status = serverStatus(starting, running)
  const freeMemory = (local.system as { freeMemoryBytes?: number } | undefined)?.freeMemoryBytes
  const metal = local.system?.platform === 'darwin' && shown.localGpuLayers > 0
  return (
    <div className="local-llm-server-card">
      <div className="local-llm-server-header">
        <div className="local-llm-server-header-left">
          <div className="local-llm-server-icon">
            <SettingsIcon name="dns" />
          </div>
          <div className="local-llm-server-header-text">
            <div className="local-llm-server-title-row">
              <span className="local-llm-server-title">{st('settings.api.localModels.llmServerTitle')}</span>
              <span className={`local-llm-server-status-pill ${status}`}>
                {st(`settings.api.localModels.${status}`)}
              </span>
            </div>
            <div className="local-llm-server-subtitle">
              {running && selected
                ? `${st('settings.api.localModels.llmServerSubtitle')} ${st('settings.api.localModels.currentModel')}: ${selected.id}.`
                : st('settings.api.localModels.llmServerSubtitle')}
            </div>
          </div>
        </div>
      </div>
      <div className="local-preview-stats">
        <Stat
          label={st('settings.api.localModels.currentModel')}
          value={
            selected
              ? infoOf(selected, ws.state!.modelCatalog).name
              : st('settings.api.localModels.summaryNoModelSelected')
          }
        />
        <Stat label={st('settings.api.localModels.summaryStorage')} value={storage ? formatBytes(storage) : '—'} />
        <Stat
          label={st('settings.api.localModels.systemMemoryTitle')}
          value={
            local.system?.totalMemoryBytes && freeMemory
              ? st('settings.api.localModels.systemMemoryValue', {
                  total: formatBytes(local.system.totalMemoryBytes),
                  available: formatBytes(freeMemory),
                })
              : st('settings.api.localModels.systemMemoryUnknown')
          }
        />
        <Stat
          label={st('settings.api.localModels.autostartTitle')}
          value={st(
            settings.localAutoStart
              ? 'settings.api.localModels.summaryAutostartEnabled'
              : 'settings.api.localModels.summaryAutostartDisabled',
          )}
        />
        <Stat
          label={st('settings.api.localModels.computeBackendTitle')}
          value={st(
            running && metal
              ? 'settings.api.localModels.computeBackendMetal'
              : 'settings.api.localModels.computeBackendCpu',
          )}
        />
      </div>
      <RuntimeNote kind="llm" />
      {runtime?.error ? (
        <div className="local-llm-preset-note" role="note">
          <SettingsIcon name="sync_problem" />
          <div className="local-llm-preset-note-content">
            <div className="local-llm-preset-note-text">{runtime.error}</div>
          </div>
        </div>
      ) : null}
      <SwitchRow
        title={st('settings.api.localModels.autostartTitle')}
        description={st('settings.api.localModels.autostartDescription')}
        checked={settings.localAutoStart}
        onChange={(value) =>
          void ws.act(async () => {
            await ws.api.settings({ localAutoStart: value })
          })
        }
      />
      <LlmServerActions launch={launch} />
    </div>
  )
}
// keys: settings.api.localModels.computeBackendCpu settings.api.localModels.computeBackendMetal
// keys: settings.api.localModels.running settings.api.localModels.starting settings.api.localModels.stopped
// keys: settings.api.localModels.summaryAutostartDisabled settings.api.localModels.summaryAutostartEnabled
// keys: settings.api.localModels.systemMemoryValue
