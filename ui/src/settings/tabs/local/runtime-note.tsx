import { useWorkspace } from '@/workspace'
import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'
import type { Kind } from './model-list'

// LearnTranscriber starts its local servers from llama.cpp and whisper.cpp executables that Homebrew installs or the
// user chooses, rather than shipping them inside the app; this note only appears while an executable is missing.
export function RuntimeNote({ kind }: { kind: Kind }) {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const state = ws.state!
  if (state.localModels.binaries[kind]) return null
  const install = state.runtimeInstalls.find((item) => item.kind === kind)
  const binary = kind === 'llm' ? 'llama-server' : 'whisper-server'
  return (
    <div className="local-llm-preset-note local-llm-cuda-bundle-note" role="note">
      <SettingsIcon name={install ? 'downloading' : 'download'} />
      <div className="local-llm-preset-note-content">
        <div className="local-llm-preset-note-title">{st('local.runtimeMissingTitle', { binary })}</div>
        <div className="local-llm-preset-note-text">
          {install ? install.progress : st('local.runtimeMissingText', { binary })}
        </div>
        <div className="local-llm-cuda-bundle-actions">
          {install ? (
            <button
              className="glass-button-small"
              onClick={() => void ws.act(() => ws.api.cancelRuntime(kind).then(() => undefined))}
            >
              <span>{st('settings.api.localModels.cancel', 'Cancel')}</span>
            </button>
          ) : (
            <>
              <button
                className="glass-button-small"
                onClick={() => void ws.act(() => ws.api.installRuntime(kind).then(() => undefined))}
              >
                <SettingsIcon name="download" />
                <span>{st('local.runtimeInstall')}</span>
              </button>
              <button
                className="glass-button-small"
                onClick={() => void ws.act(() => ws.api.pickLocalBinary(kind).then(() => undefined))}
              >
                <span>{st('local.runtimeChoose', { binary })}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
