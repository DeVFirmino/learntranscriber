import type { CSSProperties } from 'react'
import { useT } from '@/use-t'
import type { PermissionNeed } from './listening-choices'

const base = import.meta.env.BASE_URL

// Where the LearnTranscriber switch sits in each System Settings image, as percentages of the image.
const CLIPS: Record<PermissionNeed, { image: string; x: number; y: number }> = {
  microphone: { image: 'settings-microphone.webp', x: 92.29, y: 69.64 },
  speech: { image: 'settings-speech.webp', x: 92.29, y: 71.67 },
  screen: { image: 'settings-screen.webp', x: 92.29, y: 73.53 },
}

// The real System Settings pane for one permission, with a pointer that turns LearnTranscriber on. Other apps in the
// list are blurred in the image itself.
export function PermissionClip({ need }: { need: PermissionNeed }) {
  const { t } = useT()
  const clip = CLIPS[need]
  return (
    <figure
      className="onboarding-clip"
      style={{ '--switch-x': `${clip.x}%`, '--switch-y': `${clip.y}%` } as CSSProperties}
    >
      <img src={`${base}onboarding/${clip.image}`} alt={t('onboardingFlow.clipAlt')} draggable={false} />
      <span className="onboarding-clip-switch" aria-hidden="true" />
      <svg className="onboarding-clip-cursor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3l14 8.5-6.4 1.6L9.4 19z" />
      </svg>
      <figcaption>{t('onboardingFlow.clipCaption')}</figcaption>
    </figure>
  )
}
