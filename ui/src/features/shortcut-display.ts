// How an Electron accelerator reads on screen: Command-or-Control and Command are ⌘,
// Alt is ⌥ on a Mac, and Electron's Return is shown as Enter.
export function displayKeys(accelerator: string) {
  if (!accelerator) return []
  return accelerator
    .replace('CommandOrControl', '⌘')
    .replace('Command', '⌘')
    .replace('Control', 'Ctrl')
    .replace('Alt', '⌥')
    .replace(/\bReturn\b/, 'Enter')
    .split('+')
    .filter(Boolean)
}
