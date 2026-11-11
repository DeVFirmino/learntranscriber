import type { SVGProps } from 'react'
import { BrandShortcuts } from './brand-icon'

type GlyphProps = Omit<SVGProps<SVGSVGElement>, 'ref'>

const ACCENT = 'var(--brand-icon-accent, #2581ff)'

// The shortcut sheet's key is the same glyph as the Shortcuts icon.
export const ShortcutKeyGlyph = BrandShortcuts

// A window split like the app mark: the title bar in the foreground colour, the body and arrow in blue. The arrow
// points up to open the session panel above the bar and down to close it.
export function SessionPanelGlyph({ open, className = '', ...props }: GlyphProps & { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`brand-icon ${className}`.trim()}
      {...props}
    >
      <path d="M2.5 11.5V6a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v5.5M2.5 8.5h19" stroke="currentColor" />
      <path
        d={`M21.5 14v4a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-4${open ? 'M9 13.5l3 3 3-3' : 'M9 16.5l3-3 3 3'}`}
        stroke={ACCENT}
      />
    </svg>
  )
}
