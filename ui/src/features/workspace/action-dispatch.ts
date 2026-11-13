type Direction = -1 | 1

export interface ActionHooks {
  overlay(): boolean
  floating(event: 'floating-ask' | 'floating-compose' | 'floating-escape' | 'floating-response'): void
  go(route: string): void
  capture(): Promise<unknown>
  quickScreenshot(): boolean
  recording(): boolean
  insightNow(): Promise<unknown>
  toggleListening(): Promise<unknown>
  togglePause(): Promise<unknown>
  muteMicrophone(): void
  ask(): Promise<unknown>
  scroll(direction: Direction): void
  showResponse(direction: Direction): void
}

type Handler = (hooks: ActionHooks) => unknown

// The floating assistant owns live analysis and its question box. Capture attaches a screenshot there, ready to send.
const FLOATING: Record<string, Handler> = {
  analyze: (hooks) => hooks.insightNow(),
  showResponse: (hooks) => hooks.floating('floating-response'),
  ask: (hooks) => hooks.floating('floating-ask'),
  capture: (hooks) => {
    if (!hooks.quickScreenshot()) hooks.floating('floating-compose')
    return hooks.capture()
  },
  escape: (hooks) => hooks.floating('floating-escape'),
}

const WORKSPACE: Record<string, Handler> = {
  openSettings: (hooks) => hooks.go('settings/general'),
  openAiModels: (hooks) => hooks.go('settings/ai/models/analysis'),
  openAiSources: (hooks) => hooks.go('settings/ai/sources'),
  openAudioSources: (hooks) => hooks.go('settings/general'),
  openAssistants: (hooks) => hooks.go('assistants'),
  capture: (hooks) => hooks.capture(),
  record: (hooks) => (hooks.recording() ? hooks.insightNow() : hooks.toggleListening()),
  toggleRecording: (hooks) => hooks.toggleListening(),
  pauseRecording: (hooks) => hooks.togglePause(),
  mic: (hooks) => {
    if (hooks.recording()) hooks.muteMicrophone()
  },
  ask: (hooks) => hooks.ask(),
  scrollUp: (hooks) => hooks.scroll(-1),
  scrollDown: (hooks) => hooks.scroll(1),
  previousResponse: (hooks) => hooks.showResponse(-1),
  nextResponse: (hooks) => hooks.showResponse(1),
}

// Runs a shortcut or menu action in this window; an action it has no handler for does nothing.
export async function dispatchAction(action: string, hooks: ActionHooks): Promise<void> {
  const handlers = hooks.overlay() ? FLOATING : WORKSPACE
  if (Object.hasOwn(handlers, action)) await handlers[action](hooks)
}

// Before any press, previous shows the newest response and next the oldest; both stop at the ends.
export function responseIndex(current: number | null, count: number, direction: Direction): number {
  return Math.max(0, Math.min(count - 1, (current ?? (direction < 0 ? count : -1)) + direction))
}
