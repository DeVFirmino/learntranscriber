import { forwardRef } from 'react'
import type { LucideProps } from 'lucide-react'
import icons from '@/brand/icons.json'

export type BrandIconName = keyof typeof icons

// One navigation glyph: the two conversation forms of the app mark become its foreground and blue parts.
export const BrandGlyph = forwardRef<SVGSVGElement, LucideProps & { name: BrandIconName }>(function BrandGlyph(
  { name, size = 24, className = '', ...props },
  ref,
) {
  const shape = icons[name]
  const accent = 'var(--brand-icon-accent, #2581ff)'
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`brand-icon ${className}`.trim()}
      data-brand-icon={name}
      {...props}
    >
      <path
        d={shape.foreground}
        fill={shape.foregroundStroke ? 'none' : 'currentColor'}
        stroke={shape.foregroundStroke ? 'currentColor' : 'none'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={shape.accent}
        fill={shape.accentStroke ? 'none' : accent}
        stroke={shape.accentStroke ? accent : 'none'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
})
