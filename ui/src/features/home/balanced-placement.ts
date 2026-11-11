export type Column = 'main' | 'side'
export type Placement = Record<string, Column>

export interface Measured {
  // Height of the cards that always stay in each column, gaps between them included.
  main: number
  side: number
  // Height of each card that may sit in either column.
  movable: { id: string; height: number }[]
  gap: number
}

// A move must shorten the taller column by at least this much, so a card does not hop back and forth while heights
// settle after it moves.
const HYSTERESIS = 16

function tallest(measured: Measured, placement: Placement) {
  const height = { main: measured.main, side: measured.side }
  for (const card of measured.movable) {
    const column = placement[card.id] ?? 'main'
    height[column] += (height[column] ? measured.gap : 0) + card.height
  }
  return Math.max(height.main, height.side)
}

// The placement of the movable cards that leaves the taller of the two columns shortest. Every combination is tried,
// since Home has only a couple of movable cards; the current placement stays unless another is clearly better.
export function bestPlacement(measured: Measured, current: Placement): Placement {
  let best = current
  let bestHeight = tallest(measured, current) - HYSTERESIS
  const ids = measured.movable.map((card) => card.id)
  for (let mask = 0; mask < 2 ** ids.length; mask += 1) {
    const candidate: Placement = Object.fromEntries(
      ids.map((id, index) => [id, mask & (2 ** index) ? 'side' : 'main'] as const),
    )
    const height = tallest(measured, candidate)
    if (height < bestHeight) {
      best = candidate
      bestHeight = height
    }
  }
  return best
}
