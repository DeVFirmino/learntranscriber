import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { shortcutKeys } from './first-try'
import './first-try.css'

// The first real session's opening tip, above the bar's controls until listening starts: how to start, and what to
// play. Hide turns the whole first-session guide off.
export function BarGuide() {
  const ws = useWorkspace()
  const { t } = useT()
  const state = ws.state
  if (!state) return null
  const keys = shortcutKeys(state.shortcutDefinitions, 'record')
  const hide = () =>
    void ws.act(async () => {
      await ws.api.settings({ onboardingGuide: false })
    })
  return (
    <div className="bar-guide" role="note">
      <span className="bar-guide-dot" aria-hidden="true" />
      <p>{keys ? t('firstTry.startWithKeys', { keys }) : t('firstTry.start')}</p>
      <button type="button" className="bar-guide-hide" onClick={hide}>
        {t('firstTry.hide')}
      </button>
    </div>
  )
}
