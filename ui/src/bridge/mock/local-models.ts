import type { LocalModelsApi } from '../types/local-models'
import type { MockContext } from './state'
import { CATALOG } from './model-catalog'
import { wait } from './simulated-delay'
import { text, validateEndpoint } from './input-validation'

export function localModelsApi(ctx: MockContext) {
  const { state, localChanges, runtimeChanges, local, emitLocal } = ctx
  const api: LocalModelsApi = {
    discoverLocalServers: async () => [
      { id: 'ollama', name: 'Ollama', endpoint: 'http://127.0.0.1:11434/v1', available: false, models: [] },
      { id: 'lmstudio', name: 'LM Studio', endpoint: 'http://127.0.0.1:1234/v1', available: false, models: [] },
    ],
    localState: async () => structuredClone(local),
    setLocalContextSize: async ({ id, value }) => {
      const model = local.models.find((item) => item.id === id)
      if (!model || model.kind !== 'llm' || !Number.isInteger(value) || value < 512 || value > 131072)
        throw new Error('Choose a language model and a context from 512 to 131,072 tokens.')
      model.contextSize = value
      return emitLocal()
    },
    setLocalLaunchSettings: async ({ id, settings: preferences, clear, restart }) => {
      const model = local.models.find((item) => item.id === id && item.kind === 'llm')
      if (!model) throw new Error('Choose a language model.')
      if (clear) {
        delete model.launchSettings
        delete model.contextSize
      } else model.launchSettings = { ...model.launchSettings, ...preferences }
      if (restart) local.runtimes.llm = { status: 'running', modelId: id, error: '' }
      return emitLocal()
    },
    importLocalProjector: async (id) => {
      const model = local.models.find((item) => item.id === id && item.kind === 'llm')
      if (!model) throw new Error('Language model not found.')
      model.projector = { bytes: 1024, sha256: '1'.repeat(64) }
      model.projectorAvailable = false
      return emitLocal()
    },
    pickLocalBinary: async (type) => {
      local.binaries[type] = type === 'llm' ? 'preview-llama-server' : 'preview-whisper-server'
      return emitLocal()
    },
    importLocalModel: async (type) => {
      local.models.push({
        id: crypto.randomUUID(),
        kind: type,
        name: `${type === 'llm' ? 'Imported language model' : 'Imported Whisper model'} · preview record`,
        sha256: '0'.repeat(64),
        bytes: 1024,
        available: false,
      })
      return emitLocal()
    },
    downloadLocalModel: async (input) => {
      if (!/^[a-fA-F0-9]{64}$/.test(input.sha256)) throw new Error('Enter the publisher SHA-256.')
      validateEndpoint(input.url)
      const operation = { kind: input.kind, phase: 'Preview check', bytes: 0, total: null }
      local.operations.push(operation)
      emitLocal()
      await wait(250)
      local.operations = local.operations.filter((item) => item !== operation)
      local.models.push({
        id: crypto.randomUUID(),
        kind: input.kind,
        name: `${text(input.name, 120)} · preview record`,
        sha256: input.sha256.toLowerCase(),
        bytes: 1024,
        available: false,
      })
      return emitLocal()
    },
    cancelLocal: async (type) => {
      local.operations = local.operations.filter((item) => item.kind !== type)
      emitLocal()
      return true
    },
    verifyLocalModel: async (id) => {
      const model = local.models.find((item) => item.id === id)
      if (!model) throw new Error('Model not found.')
      if (!model.available) throw new Error('The preview record has no model file to verify.')
      return true
    },
    removeLocalModel: async (id) => {
      const runtime = Object.values(local.runtimes).find((item) => item.modelId === id && item.status !== 'stopped')
      if (runtime) throw new Error('Stop the server before removing its model.')
      local.models = local.models.filter((item) => item.id !== id)
      return emitLocal()
    },
    startLocalModel: async (id) => {
      const model = local.models.find((item) => item.id === id)
      if (!model || !model.available) throw new Error('The preview record has no model file to start.')
      if (state.runtimeInstalls.length) throw new Error('Wait for runtime installation before starting a local server.')
      local.runtimes[model.kind] = { status: 'running', modelId: id, error: '' }
      return emitLocal()
    },
    stopLocalModel: async (type) => {
      local.runtimes[type] = { status: 'stopped', modelId: null, error: '' }
      return emitLocal()
    },
    onLocalChange: localChanges.subscribe,
    installRuntime: async (kind) => {
      state.runtimeInstalls = [{ kind, progress: 'Preview only. Homebrew was not run.' }]
      runtimeChanges.emit(state.runtimeInstalls)
      await wait(200)
      state.runtimeInstalls = []
      runtimeChanges.emit(state.runtimeInstalls)
      local.binaries[kind] = kind === 'llm' ? 'preview-llama-server' : 'preview-whisper-server'
      return emitLocal()
    },
    cancelRuntime: async (kind) => {
      state.runtimeInstalls = state.runtimeInstalls.filter((item) => item.kind !== kind)
      runtimeChanges.emit(state.runtimeInstalls)
      return true
    },
    downloadCatalog: async (id) => {
      const model = CATALOG.find((item) => item.id === id)
      if (!model) throw new Error('Choose a catalog model.')
      if (local.models.some((item) => item.id === `preview-${id}`)) return structuredClone(local)
      local.operations.push({ kind: model.kind, phase: 'Preview record', bytes: 0, total: null })
      emitLocal()
      await wait(200)
      local.operations = local.operations.filter((item) => item.phase !== 'Preview record')
      local.models.push({
        id: `preview-${id}`,
        catalogId: id,
        kind: model.kind,
        name: `${model.name} · preview record`,
        sha256: model.sha256,
        bytes: 1024,
        available: false,
      })
      return emitLocal()
    },
    onRuntimeChange: runtimeChanges.subscribe,
  }
  return api
}
