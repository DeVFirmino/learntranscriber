import type { ReactNode } from 'react'

// One labelled value in a local engine's summary row.
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="local-preview-stat">
      <span className="local-preview-stat-label">{label}</span>
      <span className="local-preview-stat-value">{value}</span>
    </div>
  )
}
