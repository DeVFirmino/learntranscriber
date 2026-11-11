import type { PermissionNeed } from './listening-choices'

export type PermissionTone = 'done' | 'now' | 'later'

function tone(granted: boolean, current: boolean): PermissionTone {
  if (granted) return 'done'
  if (current) return 'now'
  return 'later'
}

// One permission at a time, in the order the step asks: the first one still missing is the current one, and the
// ones after it wait their turn. Nothing current means everything the chosen audio needs is allowed.
export function permissionPlan(needs: PermissionNeed[], granted: Record<PermissionNeed, boolean>) {
  const current = needs.find((need) => !granted[need]) ?? null
  return {
    current,
    rows: needs.map((need) => ({ need, tone: tone(granted[need], need === current) })),
  }
}
