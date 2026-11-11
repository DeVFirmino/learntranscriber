import type { LocalLaunchSettings } from '@/bridge/types/local-models'
import type { Settings } from '@/bridge/types/settings'
import { useWorkspace } from '@/workspace'
import { downloadedBytes, effectiveLaunch, launchPreset, savedLaunch, shownLaunch } from '../../local-launch'

// The local analysis server as the Analysis pane shows it: its selected model, the values it starts with, whether
// it runs or is busy, and how to save new launch values. Use it only while the workspace state is loaded.
export function useLocalLaunch() {
  const ws = useWorkspace()
  const state = ws.state!
  const settings = state.settings as Settings & LocalLaunchSettings
  const local = state.localModels
  const runtime = local.runtimes.llm
  const running = runtime?.status === 'running'
  const models = local.models.filter((model) => model.kind === 'llm')
  const available = models.filter((model) => model.available)
  const selected = available.find((model) => model.id === runtime?.modelId) || available[0]
  const saved = savedLaunch(selected)
  const effective = effectiveLaunch(saved, selected, settings)
  return {
    settings,
    local,
    runtime,
    running,
    starting: runtime?.status === 'starting',
    busy: Boolean(local.operations.find((item) => item.kind === 'llm')) || state.runtimeInstalls.length > 0,
    selected,
    saved,
    effective,
    preset: launchPreset(saved, runtime, local.system),
    shown: shownLaunch(running ? runtime?.launchConfig : null, effective),
    storage: downloadedBytes(models),
    launch: (patch: { settings?: LocalLaunchSettings; clear?: boolean; restart?: boolean }) =>
      void ws.act(async () => {
        if (!selected) return
        await ws.api.setLocalLaunchSettings({ id: selected.id, ...patch })
      }),
  }
}

export type LocalLaunch = ReturnType<typeof useLocalLaunch>
