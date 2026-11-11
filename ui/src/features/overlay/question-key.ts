// Shift keeps multiline input available; IME confirmation must never send an unfinished composition.
export function submitsQuestion({
  key,
  shiftKey,
  composing,
  keyCode,
}: {
  key: string
  shiftKey: boolean
  composing: boolean
  keyCode?: number
}) {
  return key === 'Enter' && !shiftKey && !composing && keyCode !== 229
}
