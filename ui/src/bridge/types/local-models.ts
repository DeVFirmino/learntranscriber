import type { Unsubscribe } from './subscription'

export interface DiscoveredServer {
  id: string
  name: string
  endpoint: string
  available: boolean
  models: string[]
}

export interface LocalLaunchSettings {
  localContextSize?: number
  localGpuLayers?: number
  localBatchSize?: number
  localUbatchSize?: number
  localParallel?: number
  localWarmup?: boolean
}

export interface LocalModel {
  id: string
  catalogId?: string
  kind: string
  name: string
  sha256: string
  bytes: number
  available: boolean
  contextSize?: number
  launchSettings?: LocalLaunchSettings
  projector?: { bytes: number; sha256: string }
  projectorAvailable?: boolean
  vision?: boolean
}

export interface RuntimeState {
  status: string
  modelId: string | null
  error: string
  contextSize?: number | null
  requestedContextSize?: number | null
  fallbackNotice?: string
  launchConfig?: LocalLaunchConfig | null
  tuning?: { base: LocalLaunchConfig; effective: LocalLaunchConfig; attempts: number; autoTuned: boolean } | null
}

export interface LocalLaunchConfig {
  contextSize: number
  gpuLayers: number
  batchSize: number
  ubatchSize: number
  parallel: number
  warmup: boolean
  threads: number
}

export interface LocalOperation {
  kind: string
  phase: string
  bytes: number
  total: number | null
}

export interface LocalState {
  system?: { platform: string; arch: string; totalMemoryBytes: number; freeMemoryBytes?: number; cpuCount: number }
  models: LocalModel[]
  binaries: Record<string, string>
  operations: LocalOperation[]
  runtimes: Record<string, RuntimeState>
}

export interface CatalogModel {
  id: string
  kind: string
  name: string
  url: string
  sha256: string
  bytes?: number
  legacy?: boolean
  recommended?: boolean
  contextLength?: number
  projector?: { url: string; sha256: string; bytes: number }
}

export interface LocalModelsApi {
  discoverLocalServers: () => Promise<DiscoveredServer[]>
  localState: () => Promise<LocalState>
  setLocalContextSize: (input: { id: string; value: number }) => Promise<LocalState>
  setLocalLaunchSettings: (input: {
    id: string
    settings?: LocalLaunchSettings
    clear?: boolean
    restart?: boolean
  }) => Promise<LocalState>
  importLocalProjector: (id: string) => Promise<LocalState>
  pickLocalBinary: (type: string) => Promise<LocalState>
  importLocalModel: (type: string) => Promise<LocalState>
  downloadLocalModel: (input: { kind: string; name: string; url: string; sha256: string }) => Promise<LocalState>
  cancelLocal: (type: string) => Promise<boolean>
  verifyLocalModel: (id: string) => Promise<unknown>
  removeLocalModel: (id: string) => Promise<LocalState>
  startLocalModel: (id: string) => Promise<LocalState>
  stopLocalModel: (type: string) => Promise<LocalState>
  onLocalChange: (listener: (value: LocalState) => void) => Unsubscribe
  installRuntime: (kind: string) => Promise<LocalState>
  cancelRuntime: (kind: string) => Promise<unknown>
  downloadCatalog: (id: string) => Promise<LocalState>
  onRuntimeChange: (listener: (items: { kind: string; progress: string }[]) => void) => Unsubscribe
}
