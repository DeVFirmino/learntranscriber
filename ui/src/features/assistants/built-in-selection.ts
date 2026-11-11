import type { PublicState } from '@/bridge/types/state'

type SelectionState = Pick<PublicState, 'assistants' | 'builtInAssistants'> & {
  settings: Pick<PublicState['settings'], 'assistantsChosen'>
}

// Before the first choice every built-in starts checked; afterwards the ones still in the library are.
export function initialBuiltInSelection(state: SelectionState): string[] {
  const catalog = state.builtInAssistants.map((item) => item.id)
  if (!state.settings.assistantsChosen) return catalog
  return catalog.filter((id) => state.assistants.some((assistant) => assistant.id === id))
}

export function toggleSelection(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]
}

// Choosing no built-in is allowed only while the user has assistants of their own.
export function canSaveSelection(state: SelectionState, selected: string[]): boolean {
  const catalog = new Set(state.builtInAssistants.map((item) => item.id))
  return selected.length > 0 || state.assistants.some((assistant) => !catalog.has(assistant.id))
}
