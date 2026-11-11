import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { cn } from 'cn'
import './segmented-tabs.css'

export interface Segment<T extends string> {
  value: T
  label: ReactNode
}

// An iOS-style segmented control for a Tabs root: a thumb slides to the active segment, and Radix supplies the tab
// roles and arrow keys. The thumb's place goes into CSS variables after layout, so it moves without a React render,
// and it only starts animating once it has been placed the first time.
export function SegmentedTabsList<T extends string>({
  value,
  segments,
  label,
  className,
}: {
  value: T
  segments: Segment<T>[]
  label: string
  className?: string
}) {
  const list = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const node = list.current
    const view = node?.ownerDocument.defaultView
    if (!node || !view) return
    const place = () => {
      const active = node.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
      if (!active) return
      node.style.setProperty('--segment-x', `${active.offsetLeft}px`)
      node.style.setProperty('--segment-width', `${active.offsetWidth}px`)
    }
    place()
    const frame = view.requestAnimationFrame(() => (node.dataset.placed = 'true'))
    const observer = new view.ResizeObserver(place)
    observer.observe(node)
    for (const tab of node.querySelectorAll('[role="tab"]')) observer.observe(tab)
    return () => {
      view.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [value, segments])
  return (
    <TabsPrimitive.List ref={list} aria-label={label} className={cn('segmented-tabs', className)}>
      <span aria-hidden="true" className="segmented-tabs-thumb" />
      {segments.map((segment) => (
        <TabsPrimitive.Trigger key={segment.value} value={segment.value} className="segmented-tabs-trigger">
          {segment.label}
        </TabsPrimitive.Trigger>
      ))}
    </TabsPrimitive.List>
  )
}
