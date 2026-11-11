export type ZoomAction = 'in' | 'out' | 'reset'

export function nextWorkspaceZoom(level: number, action: ZoomAction): number {
  if (action === 'reset') return 100
  const current = Number.isFinite(level) ? Math.round(level / 10) * 10 : 100
  return Math.max(70, Math.min(150, current + (action === 'in' ? 10 : -10)))
}

export function workspaceZoomAction(event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
}): ZoomAction | null {
  if (!event.metaKey || event.ctrlKey || event.altKey) return null
  if (event.key === '=' || event.key === '+') return 'in'
  if (event.key === '-') return 'out'
  return event.key === '0' ? 'reset' : null
}
