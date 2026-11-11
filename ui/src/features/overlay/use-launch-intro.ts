import { useEffect, useState } from 'react'
import { INTRO_MAX_MS, INTRO_MIN_MS, introDone } from './launch-intro'

// Whether the bar still shows its launch intro: once per window, from mount until the workspace state is ready and
// the minimum time has passed.
export function useLaunchIntro(ready: boolean) {
  const [started] = useState(() => performance.now())
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (done) return
    const check = () => {
      if (introDone(performance.now() - started, ready)) setDone(true)
    }
    check()
    const timers = [INTRO_MIN_MS, INTRO_MAX_MS].map((ms) =>
      window.setTimeout(check, Math.max(0, ms - (performance.now() - started))),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [done, ready, started])
  return !done
}
