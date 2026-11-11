import { useEffect, useRef, useState } from 'react'
import { HOLD_DELAY_MS, nextHold, type HoldEvent, type HoldState } from './held-command'

// Whether Command has been held alone long enough to show the shortcut sheet. Only the focused floating window sees
// the key, so the sheet is a guide for when the bar is in use, not a global gesture.
export function useHeldCommand() {
  const [shown, setShown] = useState(false)
  const state = useRef<HoldState>('idle')
  useEffect(() => {
    let timer = 0
    const apply = (event: HoldEvent) => {
      const before = state.current
      state.current = nextHold(before, event)
      if (state.current === 'waiting' && before !== 'waiting')
        timer = window.setTimeout(() => apply({ type: 'elapsed' }), HOLD_DELAY_MS)
      if (state.current !== 'waiting') window.clearTimeout(timer)
      setShown(state.current === 'shown')
    }
    const down = (event: KeyboardEvent) => apply({ type: 'down', key: event.key })
    const up = (event: KeyboardEvent) => apply({ type: 'up', key: event.key })
    const blur = () => apply({ type: 'blur' })
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])
  return shown
}
