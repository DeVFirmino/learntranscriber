import type { ShortcutDefinition } from '../../../bridge/types/settings'
import { comparisonKey } from '../../../features/shortcut-keys'

export type Override = { accelerator: string; enabled: boolean }

// The shortcut editor's listing order. Local-only shortcuts keep working with their
// saved keys but are not listed; they have no row here.
const ORDER = [
  'execute',
  'screenshot',
  'whisper',
  'toggleMicCapture',
  'scrollUp',
  'scrollDown',
  'notchHistoryPrev',
  'notchHistoryNext',
  'anchorPrev',
  'anchorNext',
  'toggleVisibility',
  'toggleActionBar',
  'toggleAlwaysOnTop',
  'increaseAppOpacity',
  'decreaseAppOpacity',
  'moveWindowLeft',
  'moveWindowRight',
  'moveWindowUp',
  'moveWindowDown',
]

// The shortcuts the editor lists, in this order.
export function listedShortcuts(definitions: ShortcutDefinition[]) {
  return ORDER.map((reference) => definitions.find((item) => item.reference === reference)).filter(
    (item): item is ShortcutDefinition => Boolean(item),
  )
}

// The other enabled shortcut that already presses these keys, if any.
export function shortcutOwner(definitions: ShortcutDefinition[], id: string, accelerator: string, platform: string) {
  const key = comparisonKey(accelerator, platform)
  return definitions.find((item) => item.id !== id && item.enabled && comparisonKey(item.accelerator, platform) === key)
}

// The saved table with one shortcut changed, or back to its default.
export function withOverride(overrides: Record<string, Override>, id: string, override: Override) {
  return { ...overrides, [id]: override }
}

export function withoutOverride(overrides: Record<string, Override>, id: string) {
  const next = { ...overrides }
  delete next[id]
  return next
}
