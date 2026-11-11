'use client'

import { ScrollFollowing, atLatest } from '@/features/scroll-following'

import * as React from 'react'
import { cn } from 'cn'
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'

function ScrollArea({
  className,
  children,
  follow = false,
  onFollowChange,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  follow?: boolean
  onFollowChange?: (following: boolean) => void
}) {
  const viewport = React.useRef<HTMLDivElement>(null)
  const following = React.useRef(new ScrollFollowing())
  React.useEffect(() => {
    if (!viewport.current) return
    const element = viewport.current
    following.current.following = follow
    const measure = () => {
      if (follow && following.current.following) element.scrollTop = element.scrollHeight
      onFollowChange?.(atLatest(element))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    measure()
    const mutations = new MutationObserver(measure)
    mutations.observe(element, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      mutations.disconnect()
    }
  }, [follow, onFollowChange])
  const pause = () => {
    following.current.pause()
    if (viewport.current) onFollowChange?.(atLatest(viewport.current))
  }
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative min-w-0', className)}
      onPointerDownCapture={(event) => {
        if (event.target instanceof Element && event.target.closest('[data-slot="scroll-area-scrollbar"]')) {
          pause()
        }
      }}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewport}
        tabIndex={0}
        role={props['aria-label'] ? 'region' : undefined}
        aria-label={props['aria-label']}
        onScroll={(event) => {
          const e = event.currentTarget
          following.current.scrolled(e)
          onFollowChange?.(atLatest(e))
        }}
        onPointerDown={(event) => {
          if (event.pointerType === 'touch') pause()
        }}
        onTouchMove={() => {
          pause()
        }}
        onKeyDown={(event) => {
          if (['ArrowUp', 'PageUp', 'Home'].includes(event.key) || (event.key === ' ' && event.shiftKey)) {
            pause()
          }
        }}
        onWheel={(event) => {
          if (event.deltaY < 0) {
            pause()
          }
        }}
        data-slot="scroll-area-viewport"
        className="size-full min-w-0 rounded-[inherit] [&>div]:!block [&>div]:min-w-0 transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        'flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
