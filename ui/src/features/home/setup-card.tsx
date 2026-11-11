import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GettingStarted } from '@/features/getting-started'
import type { PublicState } from '@/bridge/types/state'
import type { SetupProgress } from '@/features/setup-progress'
import { useT } from '@/use-t'
import { SetupSummary } from './setup-summary'

// The setup checklist while something is missing; once everything is configured, a summary of it that opens the
// checklist to review.
export function SetupCard({ state, progress }: { state: PublicState; progress: SetupProgress }) {
  const { t } = useT()
  const [reviewing, setReviewing] = useState(false)
  if (progress.complete && !reviewing) return <SetupSummary state={state} onReview={() => setReviewing(true)} />
  return (
    <Card className="home-setup-card home-reveal">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('home.setup')}</CardTitle>
        {progress.complete ? (
          <Button variant="ghost" size="sm" onClick={() => setReviewing(false)}>
            {t('home.hideSetup')}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <Button variant="secondary" className="w-fit" asChild>
          <a href="#onboarding">{t('onboardingFlow.resume')}</a>
        </Button>
        <GettingStarted persistent />
      </CardContent>
    </Card>
  )
}
