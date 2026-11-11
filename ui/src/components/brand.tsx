import mark from '@/brand/mark.json'

const base = import.meta.env.BASE_URL

export function BrandMark({ className = 'h-6 w-8' }: { className?: string }) {
  return (
    <svg viewBox={mark.viewBox} className={`shrink-0 ${className}`} fill="none" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={mark.upper} />
      <path fill={mark.blue} d={mark.lower} />
    </svg>
  )
}

export function BrandName() {
  return (
    <span className="whitespace-nowrap">
      <span className="font-semibold">Learn</span>
      <span className="font-normal">Transcriber</span>
    </span>
  )
}

// The 3D version of the mark, for the moments the app introduces itself: the bar's launch and the onboarding welcome.
export function BrandMark3D({ className = 'size-8' }: { className?: string }) {
  return <img src={`${base}logo-3d.webp`} alt="" className={`shrink-0 object-contain ${className}`} draggable={false} />
}
