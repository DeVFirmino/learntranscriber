// Holding Command (Control off a Mac) alone for a moment shows the shortcut sheet; pressing any other key while it is
// held means a shortcut is being used, so the sheet stays away until Command is pressed again.
export const HOLD_DELAY_MS = 450

export type HoldState = 'idle' | 'waiting' | 'shown' | 'used'

export type HoldEvent =
  { type: 'down'; key: string } | { type: 'up'; key: string } | { type: 'elapsed' } | { type: 'blur' }

const isCommand = (key: string) => key === 'Meta' || key === 'Control'

export function nextHold(state: HoldState, event: HoldEvent): HoldState {
  if (event.type === 'blur') return 'idle'
  if (event.type === 'elapsed') return state === 'waiting' ? 'shown' : state
  if (event.type === 'up') return isCommand(event.key) ? 'idle' : state
  if (isCommand(event.key)) return state === 'idle' ? 'waiting' : state
  return state === 'idle' ? 'idle' : 'used'
}
