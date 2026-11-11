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
