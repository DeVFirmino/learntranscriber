import type { ShortcutDefinition } from '../bridge/types/settings'

export function shortcutCardState(item: ShortcutDefinition) {
  const custom = item.accelerator !== item.defaultAccelerator
  const canReset = custom || item.enabled !== item.defaultEnabled
  let state = 'default'
  if (custom) state = 'custom'
  if (!item.enabled) state = 'disabled'
  return { custom, canReset, state }
}
