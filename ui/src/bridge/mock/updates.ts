import type { UpdatesApi } from '../types/updates'
import type { MockContext } from './state'

export function updatesApi(ctx: MockContext) {
  const { updateStatus, updateChanges } = ctx
  const api: UpdatesApi = {
    updatesState: async () => structuredClone(updateStatus),
    openUpdate: async () => {
      if (!updateStatus.available) return false
      throw new Error(
        'In the app, this opens the release page in your browser. This preview does not open external pages.',
      )
    },
    // The preview walks through a download in a few steps instead of fetching anything.
    downloadUpdate: async () => {
      if (!updateStatus.available) return structuredClone(updateStatus)
      for (const progress of [0, 0.35, 0.7]) {
        updateStatus.download = { phase: 'downloading', progress, error: null }
        updateChanges.emit(structuredClone(updateStatus))
        await new Promise((resolve) => setTimeout(resolve, 400))
      }
      updateStatus.download = { phase: 'ready', progress: 1, error: null }
      updateChanges.emit(structuredClone(updateStatus))
      return structuredClone(updateStatus)
    },
    installUpdate: async () => {
      if (updateStatus.download?.phase !== 'ready') return false
      throw new Error('In the app, this opens the downloaded DMG. This preview does not open files.')
    },
    laterUpdate: async () => {
      updateStatus.available = false
      updateChanges.emit(structuredClone(updateStatus))
      return structuredClone(updateStatus)
    },
    skipUpdate: async (tagName) => {
      if (tagName === updateStatus.tagName) updateStatus.available = false
      updateChanges.emit(structuredClone(updateStatus))
      return structuredClone(updateStatus)
    },
    onUpdatesChange: updateChanges.subscribe,
  }
  return api
}
