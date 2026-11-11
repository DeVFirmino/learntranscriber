// The main process shortcut definitions (src/main/domain/settings/shortcuts.cjs): id, label, default accelerator,
// whether it starts enabled, and the known action it maps to, when it has one.
const DEFINITIONS = [
  ['hide', 'Hide / restore all windows', 'CommandOrControl+B', true, 'toggleVisibility'],
  ['overlay', 'Toggle floating assistant', 'CommandOrControl+M', true, 'toggleActionBar'],
  ['clickThrough', 'Toggle click-through', 'CommandOrControl+Shift+I', true, null],
  ['selection', 'Read selected text', 'CommandOrControl+Shift+K', true, null],
  ['ask', 'Ask / submit question', 'CommandOrControl+Return', true, 'execute'],
  ['capture', 'Capture screen', 'CommandOrControl+E', true, 'screenshot'],
  ['record', 'Start listening / analyze conversation', 'CommandOrControl+D', true, 'whisper'],
  ['mic', 'Mute / unmute microphone', 'CommandOrControl+Shift+D', true, 'toggleMicCapture'],
  ['previousInsight', 'Previous Notch insight', 'CommandOrControl+Left', true, 'notchHistoryPrev'],
  ['nextInsight', 'Next Notch insight', 'CommandOrControl+Right', true, 'notchHistoryNext'],
  ['previousResponse', 'Previous response', 'CommandOrControl+Alt+Up', true, 'anchorPrev'],
  ['nextResponse', 'Next response', 'CommandOrControl+Alt+Down', true, 'anchorNext'],
  ['scrollUp', 'Scroll up', 'CommandOrControl+Up', true, 'scrollUp'],
  ['scrollDown', 'Scroll down', 'CommandOrControl+Down', true, 'scrollDown'],
  ['onTop', 'Toggle always on top', 'CommandOrControl+Shift+A', true, 'toggleAlwaysOnTop'],
  ['opacityUp', 'Increase opacity', 'CommandOrControl+Shift+Plus', true, 'increaseAppOpacity'],
  ['opacityDown', 'Decrease opacity', 'CommandOrControl+Shift+-', true, 'decreaseAppOpacity'],
  ['moveLeft', 'Slide session panel left', 'CommandOrControl+Shift+Left', false, 'moveWindowLeft'],
  ['moveRight', 'Slide session panel right', 'CommandOrControl+Shift+Right', false, 'moveWindowRight'],
  ['moveUp', 'Slide session panel up', 'CommandOrControl+Shift+Up', true, 'moveWindowUp'],
  ['moveDown', 'Slide session panel down', 'CommandOrControl+Shift+Down', true, 'moveWindowDown'],
  ['notch', 'Toggle Notch', 'CommandOrControl+Shift+N', false, null],
] as const

// The definitions with the saved overrides applied, as the main process reports them.
export function shortcutDefinitions(saved: string) {
  const overrides = JSON.parse(saved)
  return DEFINITIONS.map(([id, label, accelerator, enabled, reference]) => ({
    id,
    label,
    accelerator,
    enabled,
    reference,
    registered: true,
    defaultAccelerator: accelerator,
    defaultEnabled: enabled,
    ...overrides[id],
  }))
}
