import { useWorkspace } from '@/workspace'
import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'
import type { LocalLaunch } from './use-local-launch'

// Start, stop and restart for the local analysis server, and whether it listens on localhost.
export function LlmServerActions({ launch }: { launch: LocalLaunch }) {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const { local, running, starting, busy, selected } = launch
  return (
    <div className="local-llm-server-footer">
      <div className="local-llm-server-actions">
        {running ? (
          <>
            <button
              className="glass-button-small local-llm-action-button stop"
              disabled={busy || starting}
              onClick={() => void ws.act(() => ws.api.stopLocalModel('llm').then(() => undefined))}
            >
              <SettingsIcon name="stop" />
              <span>{st('settings.api.localModels.stopServer')}</span>
            </button>
            <button
              className="glass-button-small local-llm-action-button"
              disabled={busy || starting || !selected}
              onClick={() => launch.launch({ restart: true })}
            >
              <SettingsIcon name="restart_alt" />
              <span>{st('settings.api.localModels.restartServer')}</span>
            </button>
          </>
        ) : (
          <>
            <button
              className="glass-button-small local-llm-action-button start"
              disabled={busy || starting || !selected || !local.binaries.llm}
              onClick={() =>
                void ws.act(async () => {
                  if (selected) await ws.api.startLocalModel(selected.id)
                })
              }
            >
              <SettingsIcon name="play_arrow" />
              <span>{st('settings.api.localModels.startServer')}</span>
            </button>
            <button className="glass-button-small local-llm-action-button" disabled>
              <SettingsIcon name="restart_alt" />
              <span>{st('settings.api.localModels.restartServer')}</span>
            </button>
          </>
        )}
      </div>
      <div className="local-llm-endpoint">
        <span className={`local-llm-endpoint-dot ${running ? 'on' : 'off'}`} aria-hidden="true" />
        <span>localhost</span>
      </div>
    </div>
  )
}
