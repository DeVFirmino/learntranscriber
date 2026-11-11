export interface NotchInsight {
  id: string
  text: string
  entryId?: string
}
export interface NotchHistory {
  items: NotchInsight[]
  position: number
}

export const emptyNotchHistory: NotchHistory = { items: [], position: -1 }

export function appendNotchInsight(current: NotchHistory, insight: NotchInsight): NotchHistory {
  if (!insight.text.trim() || current.items.at(-1)?.text === insight.text || current.items.at(-1)?.id === insight.id)
    return current
  const readingLatest = current.position < 0 || current.position === current.items.length - 1
  const items = [...current.items, insight]
  let position = readingLatest ? -1 : current.position
  if (items.length > 20) {
    const removed = position === 0 ? 1 : 0
    items.splice(removed, 1)
    if (position > removed) position--
  }
  return { items, position }
}

export function moveNotchInsight(current: NotchHistory, direction: number): NotchHistory {
  if (!current.items.length) return current
  const from = current.position < 0 ? current.items.length - 1 : current.position
  const next = Math.max(0, Math.min(current.items.length - 1, from + direction))
  return { ...current, position: next === current.items.length - 1 ? -1 : next }
}
