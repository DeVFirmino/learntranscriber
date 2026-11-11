import { useT } from '@/use-t'
import { GUIDE_STEPS } from './progress'

function segment(index: number, step: number) {
  if (index < step) return 'done'
  if (index === step) return 'current'
  return 'next'
}

// Where the person is in the setup, as five short bars; screen readers hear "Step 2 of 5".
export function GuideProgress({ step }: { step: number }) {
  const { t } = useT()
  return (
    <span className="onboarding-guide" role="img" aria-label={t('onboardingFlow.stepOf', { step, total: GUIDE_STEPS })}>
      {Array.from({ length: GUIDE_STEPS }, (_, index) => (
        <i key={index} data-state={segment(index + 1, step)} />
      ))}
    </span>
  )
}
