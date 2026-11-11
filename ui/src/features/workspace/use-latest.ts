import { useLayoutEffect, useRef } from 'react'

// A ref holding the latest rendered value, for callbacks that are created once and read it later.
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}
