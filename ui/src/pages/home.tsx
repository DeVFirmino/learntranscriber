import { OnboardingSurface } from '@/features/onboarding/surface'
import { shouldPresentOnboarding } from '@/features/onboarding/progress'
import { useWorkspace } from '@/workspace'
import { PrivacyCard } from '@/features/home/privacy-card'
import { RecentSessions } from '@/features/home/recent-sessions'
import { SessionStats } from '@/features/home/session-stats'
import { SetupCard } from '@/features/home/setup-card'
import { ShortcutsCard } from '@/features/home/shortcuts-card'
import { StartHero } from '@/features/home/start-hero'
import { UpdateBanner } from '@/features/home/update-banner'
import { setupProgress } from '@/features/setup-progress'
import { useBalancedPlacement } from '@/features/home/use-balanced-placement'
import '@/features/home/home-layout.css'
import '@/features/home/home-motion.css'

const MOVABLE = ['shortcuts', 'stats'] as const

// Home: the lead card (start a session, or the one recording now), then the recent sessions beside the setup and
// privacy. The shortcuts and the activity numbers go to whichever column keeps the two closest in height.
export function Home() {
  const ws = useWorkspace()
  const state = ws.state
  const onboarding = state ? ws.route === 'onboarding' || shouldPresentOnboarding(state) : false
  const { placement, main, side } = useBalancedPlacement(
    { shortcuts: 'main', stats: 'side' },
    Boolean(state) && !onboarding,
  )
  if (!state) return null
  if (onboarding) return <OnboardingSurface />
  const progress = setupProgress(state)
  const cards = { shortcuts: <ShortcutsCard state={state} />, stats: <SessionStats state={state} /> }
  const movable = (column: 'main' | 'side') =>
    MOVABLE.filter((id) => placement[id] === column).map((id) => (
      <div key={id} data-movable={id} className="grid">
        {cards[id]}
      </div>
    ))
  return (
    <div>
      <UpdateBanner />
      <StartHero state={state} />
      <div className="home-columns grid">
        <div ref={main} className="home-recent-area home-column grid">
          <RecentSessions state={state} />
          {movable('main')}
        </div>
        <div ref={side} className="home-details-area home-column grid">
          <SetupCard state={state} progress={progress} />
          <PrivacyCard state={state} />
          {movable('side')}
        </div>
      </div>
    </div>
  )
}
