import { useEffect, useState } from 'react'

const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// A number that climbs to its value once; with reduced motion it simply shows the value.
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(value)
  const animate = value > 0 && !still()
  useEffect(() => {
    if (!animate) return
    const start = performance.now()
    let frame = 0
    const step = (time: number) => {
      const progress = Math.min(1, (time - start) / 700)
      setShown(Math.round(value * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, animate])
  return (
    <>
      {animate ? shown : value}
      {suffix}
    </>
  )
}
