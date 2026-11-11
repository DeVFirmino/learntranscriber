import type { LucideIcon } from 'lucide-react'
import {
  BrandCapture,
  BrandNotch,
  BrandScroll,
  BrandSelection,
  BrandTimer,
  BrandTranscript,
} from '@/components/brand-icon'

const FRAME_STROKE = 1.5

// LearnTranscriber's own feature-card illustrations: one shared composition (a quiet panel with text lines and
// the feature's mark in an accent tile), drawn in the 200×120 box the card illustration slot expects.
export function FeatureArt({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="feature-card-illustration">
      <rect
        x="34"
        y="16"
        width="132"
        height="88"
        rx="16"
        strokeWidth={FRAME_STROKE}
        style={{ fill: 'rgba(255, 255, 255, 0.025)', stroke: 'rgba(255, 255, 255, 0.08)' }}
      />
      <rect x="50" y="34" width="46" height="5" rx="2.5" style={{ fill: 'rgba(255, 255, 255, 0.08)' }} />
      <rect x="50" y="46" width="30" height="5" rx="2.5" style={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
      <rect x="50" y="80" width="38" height="5" rx="2.5" style={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
      <rect
        x="104"
        y="38"
        width="44"
        height="44"
        rx="12"
        strokeWidth={FRAME_STROKE}
        style={{ fill: 'rgba(var(--lt-active-rgb), 0.1)', stroke: 'rgba(var(--lt-active-rgb), 0.3)' }}
      />
      <Icon x={114} y={48} width={24} height={24} style={{ color: 'var(--foreground)' }} />
    </svg>
  )
}

export const AutoScrollArt = () => <FeatureArt icon={BrandScroll} />
export const SelectToPromptArt = () => <FeatureArt icon={BrandSelection} />
export const SessionTimerArt = () => <FeatureArt icon={BrandTimer} />
export const NotchExperienceArt = () => <FeatureArt icon={BrandNotch} />
export const ScreenshotArt = () => <FeatureArt icon={BrandCapture} />
export const SessionNotesArt = () => <FeatureArt icon={BrandTranscript} />
