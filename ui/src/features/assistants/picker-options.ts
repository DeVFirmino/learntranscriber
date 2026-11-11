import type { Assistant } from '@/bridge/types/assistants'

// The selected identity wins when imported presets repeat a display name. Stored assistants are never changed.
export function assistantPickerOptions(assistants: Assistant[], selectedId: string): Assistant[] {
  const options = new Map<string, Assistant>()
  for (const assistant of assistants) {
    const name = assistant.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
    if (!options.has(name) || assistant.id === selectedId) options.set(name, assistant)
  }
  return [...options.values()]
}

// The floating picker shows three assistants per page; the library keeps its own page sizes.
export const PICKER_PAGE_SIZE = 3

// The 1-based page holding the selected assistant, so the picker opens where the current choice is.
export function pickerPageOf(options: { id: string }[], selectedId: string): number {
  const index = options.findIndex((option) => option.id === selectedId)
  return index < 0 ? 1 : Math.floor(index / PICKER_PAGE_SIZE) + 1
}
