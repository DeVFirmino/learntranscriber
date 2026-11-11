import { useCallback, useLayoutEffect, useRef, type ComponentProps } from 'react'
import './selection-track.css'

export function SelectionTrack({
  value,
  children,
  className = '',
  ref: forwardedRef,
  ...props
}: ComponentProps<'div'> & { value: string }) {
  const root = useRef<HTMLDivElement>(null)
  const setRoot = useCallback(
    (node: HTMLDivElement | null) => {
      root.current = node
      if (typeof forwardedRef === 'function') {
        const cleanup = forwardedRef(node)
        if (cleanup)
          return () => {
            root.current = null
            cleanup()
          }
      } else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef],
  )
  useLayoutEffect(() => {
    const container = root.current
    if (!container) return
    const update = () => {
      const selected = container.querySelector<HTMLElement>('[data-selected="true"]')
      if (!selected) return
      container.style.setProperty('--selection-x', `${selected.offsetLeft}px`)
      container.style.setProperty('--selection-y', `${selected.offsetTop}px`)
      container.style.setProperty('--selection-width', `${selected.offsetWidth}px`)
      container.style.setProperty('--selection-height', `${selected.offsetHeight}px`)
    }
    update()
    const Observer = container.ownerDocument.defaultView?.ResizeObserver
    if (!Observer) return
    const observer = new Observer(update)
    observer.observe(container)
    for (const child of container.children) observer.observe(child)
    return () => observer.disconnect()
  }, [value, children])
  return (
    <div {...props} ref={setRoot} className={`selection-track ${className}`}>
      {children}
    </div>
  )
}
