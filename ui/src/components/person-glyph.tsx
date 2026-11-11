import type { SVGProps } from 'react'

// The small person in the lower left, drawn in place so its outline keeps the family's weight.
const PERSON = 'M11.5 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM3 21.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5'

// The person in the foreground colour, small in the lower left, with a blue mark in the upper right: the icon of an
// assistant with a role or avatar, and of a session.
export function PersonGlyph({
  mark,
  className = '',
  ...props
}: { mark: string } & Omit<SVGProps<SVGSVGElement>, 'ref'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`brand-icon ${className}`.trim()}
      {...props}
    >
      <path d={PERSON} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={mark}
        stroke="var(--brand-icon-accent, #2581ff)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
