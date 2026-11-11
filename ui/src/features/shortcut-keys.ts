// Keyboard shortcut recording and conflict checks for the shortcut editor. Accelerators use Electron's format;
// the main process keeps the final validation.

type Pressed = { key: string; code: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }
type Binding = { id: string; accelerator: string; enabled: boolean; blockedBy?: string }
type Override = { accelerator: string; enabled: boolean }

const NAMED: Record<string, string> = {
  Enter: 'Return',
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Escape',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
}

// The accelerator for a key press with a Command, Control or Alt modifier; null for a lone modifier or no modifier.
// Physical key codes keep letters, digits, minus and equals stable when Alt or Shift changes the typed character.
export function recordedAccelerator(event: Pressed): string | null {
  if (!event.metaKey && !event.ctrlKey && !event.altKey) return null
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) return null
  const key = /^Key[A-Z]$/.test(event.code)
    ? event.code.slice(3)
    : /^Digit[0-9]$/.test(event.code)
      ? event.code.slice(5)
      : event.code === 'Minus'
        ? '-'
        : event.code === 'Equal'
          ? event.shiftKey
            ? 'Plus'
            : '='
          : NAMED[event.key] || (/^F([1-9]|1\d|2[0-4])$/.test(event.key) ? event.key : event.key.toUpperCase())
  return [
    ...(event.metaKey ? ['CommandOrControl'] : []),
    ...(event.ctrlKey ? ['Control'] : []),
    ...(event.altKey ? ['Alt'] : []),
    ...(event.shiftKey ? ['Shift'] : []),
    key,
  ].join('+')
}

// Two accelerators press the same keys when their modifiers and key match; Command-or-Control is Command on a Mac.
export function comparisonKey(accelerator: string, platform: string) {
  const parts = accelerator.replace(/\+Minus$/, '+-').split('+')
  const mods = parts
    .slice(0, -1)
    .map((m) => (m === 'CommandOrControl' ? (platform === 'darwin' ? 'Command' : 'Control') : m))
  const key = parts.at(-1) === 'Enter' ? 'Return' : parts.at(-1)
  return [...new Set(mods)].sort().join('+') + '+' + key
}

// The action an edited shortcut would take keys from, reported as "Already used by". Bindings
// saved before this edit keep their keys, so a configuration that already resolved stays savable.
export function shortcutConflicts(
  definitions: Binding[],
  draft: Record<string, Override>,
  saved: Record<string, Override>,
  platform: string,
) {
  const effective = definitions.map((item) => {
    const value = draft[item.id]
    return value ? { id: item.id, accelerator: value.accelerator, enabled: value.enabled } : item
  })
  const conflicts: Record<string, string> = {}
  for (const item of effective) {
    const before = saved[item.id]
    const changed = draft[item.id] && (before?.accelerator !== item.accelerator || before?.enabled !== item.enabled)
    if (!changed || !item.enabled) continue
    const key = comparisonKey(item.accelerator, platform)
    const other = effective.find(
      (entry) => entry.id !== item.id && entry.enabled && comparisonKey(entry.accelerator, platform) === key,
    )
    if (other) conflicts[item.id] = other.id
  }
  return conflicts
}
