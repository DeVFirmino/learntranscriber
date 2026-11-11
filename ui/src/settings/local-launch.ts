import type { LocalLaunchConfig, LocalLaunchSettings, LocalModel } from '@/bridge/types/local-models'
import { PRESETS, PRESET_NAMES, autoTunedPreset, recommendedPreset, sameLaunch, type Preset } from './local-presets'

// The tuning fields as the user types them; numbers stay text until they are saved.
export interface Tuning {
  ctxSize: string
  gpuLayers: string
  batchSize: string
  ubatchSize: string
  parallel: string
  warmup: boolean
}
type Launch = Required<LocalLaunchSettings>

// The launch settings the model saved for itself, if it saved any.
export function savedLaunch(model: LocalModel | undefined): LocalLaunchSettings | undefined {
  return model?.launchSettings && Object.keys(model.launchSettings).length ? model.launchSettings : undefined
}

// What the selected model starts with: its own saved values, then its context size and the global settings, then
// the safe preset.
export function effectiveLaunch(
  saved: LocalLaunchSettings | undefined,
  model: LocalModel | undefined,
  settings: LocalLaunchSettings & { localContextSize: number },
): Launch {
  return {
    localContextSize: saved?.localContextSize ?? model?.contextSize ?? settings.localContextSize,
    localGpuLayers: saved?.localGpuLayers ?? settings.localGpuLayers ?? PRESETS.safe.localGpuLayers,
    localBatchSize: saved?.localBatchSize ?? settings.localBatchSize ?? PRESETS.safe.localBatchSize,
    localUbatchSize: saved?.localUbatchSize ?? settings.localUbatchSize ?? PRESETS.safe.localUbatchSize,
    localParallel: saved?.localParallel ?? settings.localParallel ?? PRESETS.safe.localParallel,
    localWarmup: saved?.localWarmup ?? settings.localWarmup ?? PRESETS.safe.localWarmup,
  }
}

// While the server runs, the values shown are the ones it actually started with.
export function shownLaunch(config: LocalLaunchConfig | null | undefined, effective: Launch): Launch {
  if (!config) return effective
  return {
    localContextSize: config.contextSize,
    localGpuLayers: config.gpuLayers,
    localBatchSize: config.batchSize,
    localUbatchSize: config.ubatchSize,
    localParallel: config.parallel,
    localWarmup: config.warmup,
  }
}

// The preset a model's saved values match, `custom` when they match none, and otherwise the preset the server tuned
// itself to or the one recommended for this Mac.
export function launchPreset(
  saved: LocalLaunchSettings | undefined,
  runtime: Parameters<typeof autoTunedPreset>[0],
  system: Parameters<typeof recommendedPreset>[0],
): Preset | 'custom' {
  if (saved) return PRESET_NAMES.find((name) => sameLaunch(saved, PRESETS[name])) || 'custom'
  return autoTunedPreset(runtime) ?? recommendedPreset(system)
}

export function draftOf(value: Launch): Tuning {
  return {
    ctxSize: String(value.localContextSize),
    gpuLayers: String(value.localGpuLayers),
    batchSize: String(value.localBatchSize),
    ubatchSize: String(value.localUbatchSize),
    parallel: String(value.localParallel),
    warmup: value.localWarmup,
  }
}

export function launchOf(draft: Tuning): Launch {
  return {
    localContextSize: Number(draft.ctxSize),
    localGpuLayers: Number(draft.gpuLayers),
    localBatchSize: Number(draft.batchSize),
    localUbatchSize: Number(draft.ubatchSize),
    localParallel: Number(draft.parallel),
    localWarmup: draft.warmup,
  }
}

// Disk space the downloaded models use, with a vision model's projector once it is on disk.
export function downloadedBytes(models: LocalModel[]): number {
  return models.reduce(
    (total, model) =>
      total + (model.available ? model.bytes + (model.projectorAvailable ? model.projector?.bytes || 0 : 0) : 0),
    0,
  )
}
