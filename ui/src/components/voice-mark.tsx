import type { SVGProps } from 'react'
import './voice-mark.css'

const RESTING_HEIGHTS = [8, 18, 12, 6] as const

export function VoiceMark({
  active = false,
  heights = RESTING_HEIGHTS,
  className = '',
  ...props
}: {
  active?: boolean
  heights?: readonly number[]
} & Omit<SVGProps<SVGSVGElement>, 'ref'>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      data-voice-mark
      data-speaking={active || undefined}
      className={`size-5 shrink-0 ${className}`}
      {...props}
    >
      {heights.map((height, index) => (
        <rect
          key={index}
          x={1 + index * 5}
          y={(20 - height) / 2}
          width="3"
          height={height}
          rx="1.5"
          fill={index < 2 ? 'currentColor' : 'var(--brand-icon-accent, #2581ff)'}
          // Geometry also goes through style: CSS transitions ignore attribute changes, so the live wave would jump.
          style={{ height, y: (20 - height) / 2, animationDelay: `${index * 110}ms` }}
        />
      ))}
    </svg>
  )
}
