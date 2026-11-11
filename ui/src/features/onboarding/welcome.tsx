import { ArrowRight } from 'lucide-react'
import { BrandMark3D } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { useT } from '@/use-t'

export function OnboardingWelcome({ busy, onStart }: { busy: boolean; onStart: () => void }) {
  const { t } = useT()
  return (
    <div className="onboarding-welcome">
      <BrandMark3D className="onboarding-mark" />
      <h1 tabIndex={-1}>{t('onboardingFlow.welcomeTitle')}</h1>
      <p>{t('onboardingFlow.welcomeDescription')}</p>
      <div className="onboarding-actions">
        <Button className="onboarding-primary" disabled={busy} onClick={onStart}>
          {t('onboardingFlow.start')}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
