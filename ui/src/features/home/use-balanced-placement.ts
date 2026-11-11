import { useEffect, useRef, useState } from 'react'
import { bestPlacement, type Placement } from './balanced-placement'

const height = (element: Element) => element.getBoundingClientRect().height

// Keeps Home's two columns close in height: the cards marked `data-movable` go to whichever column leaves the taller
// one shortest, measured again whenever a card changes size. When the columns stack on a narrow window the default
// placement stays, so the reading order does not change. `shown` tells when the columns are on screen.
export function useBalancedPlacement(initial: Placement, shown: boolean) {
  const main = useRef<HTMLDivElement>(null)
  const side = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState(initial)
  useEffect(() => {
    const columns = [main.current, side.current]
    if (!columns[0] || !columns[1]) return
    const [mainColumn, sideColumn] = columns as HTMLDivElement[]
    const measure = () => {
      const stacked = sideColumn.offsetTop > mainColumn.offsetTop + 8
      const gap = Number.parseFloat(getComputedStyle(mainColumn).rowGap) || 0
      const fixed = (column: HTMLElement) => {
        const cards = [...column.children].filter((child) => !(child as HTMLElement).dataset.movable && height(child))
        return cards.reduce((sum, card) => sum + height(card), 0) + Math.max(0, cards.length - 1) * gap
      }
      const movable = [...mainColumn.children, ...sideColumn.children]
        .filter((child) => (child as HTMLElement).dataset.movable && height(child))
        .map((child) => ({ id: (child as HTMLElement).dataset.movable as string, height: height(child) }))
      setPlacement((current) => {
        const next = stacked
          ? initial
          : bestPlacement({ main: fixed(mainColumn), side: fixed(sideColumn), movable, gap }, current)
        return Object.keys(next).every((id) => next[id] === current[id]) ? current : next
      })
    }
    const observer = new ResizeObserver(measure)
    for (const column of [mainColumn, sideColumn]) {
      observer.observe(column)
      for (const child of column.children) observer.observe(child)
    }
    return () => observer.disconnect()
    // The placement is read through the setter; the observed children change with it.
  }, [placement, shown]) // eslint-disable-line react-hooks/exhaustive-deps
  return { placement, main, side }
}
