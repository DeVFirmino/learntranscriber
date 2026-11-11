import type { ShortcutDefinition } from '@/bridge/types/settings'
import { displayKeys } from '../shortcut-display'

export type FirstTryStage = 'start' | 'listen' | 'ask' | 'done'

// Where the first real session stands: listening first, then something heard, then an answer about it.
export function firstTryStage(milestones: { transcript: boolean; answer: boolean }, capturing: boolean): FirstTryStage {
  if (!milestones.transcript) return capturing ? 'listen' : 'start'
  if (!milestones.answer) return 'ask'
  return 'done'
}

// The keys a shortcut uses right now, as the person set them; empty when that shortcut is turned off.
export function shortcutKeys(definitions: ShortcutDefinition[], id: string): string {
  const definition = definitions.find((item) => item.id === id)
  if (!definition?.enabled) return ''
  return displayKeys(definition.accelerator).join(' ')
}
