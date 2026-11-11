import type { LocalLaunchSettings } from '@/bridge/types/local-models'

export type Preset = 'safe' | 'balanced' | 'fast'

// The performance presets and their macOS launch values.
export const PRESETS: Record<Preset, Required<LocalLaunchSettings>> = {
  safe: {
    localContextSize: 4096,
    localGpuLayers: 0,
    localBatchSize: 256,
    localUbatchSize: 64,
    localParallel: 1,
    localWarmup: false,
  },
  balanced: {
    localContextSize: 4096,
    localGpuLayers: 10,
    localBatchSize: 512,
    localUbatchSize: 128,
    localParallel: 1,
    localWarmup: false,
  },
  fast: {
    localContextSize: 8192,
    localGpuLayers: 20,
    localBatchSize: 1024,
    localUbatchSize: 256,
    localParallel: 1,
    localWarmup: true,
  },
}
export const PRESET_NAMES = Object.keys(PRESETS) as Preset[]
const LAUNCH_KEYS = Object.keys(PRESETS.safe) as (keyof LocalLaunchSettings)[]

const GIB = 1024 ** 3

// After an automatic tuning, Safe is shown instead of the recommendation.
export function autoTunedPreset(runtime?: { tuning?: { autoTuned: boolean } | null }): Preset | null {
  return runtime?.tuning?.autoTuned ? 'safe' : null
}

// The recommended preset: Apple silicon with 24 GB or more runs Fast, 16 GB Balanced.
export function recommendedPreset(system?: { platform: string; arch: string; totalMemoryBytes: number }): Preset {
  if (!system?.totalMemoryBytes) return 'safe'
  if (system.platform === 'darwin' && system.arch !== 'arm64') return 'safe'
  const gb = system.totalMemoryBytes / GIB
  if (gb >= 24) return 'fast'
  if (gb >= 16) return 'balanced'
  return 'safe'
}

export function sameLaunch(value: LocalLaunchSettings | undefined, preset: Required<LocalLaunchSettings>) {
  if (!value) return false
  return LAUNCH_KEYS.every((key) => value[key] === preset[key])
}
