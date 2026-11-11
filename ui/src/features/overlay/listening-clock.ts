// Whole seconds since listening started, never negative; zero before it starts.
export function elapsedSeconds(since: number | null, now: number): number {
  return since ? Math.max(0, Math.floor((now - since) / 1000)) : 0
}

// The bar's timer: minutes and seconds, with hours in front after the first hour, each part two digits.
export function formatElapsed(seconds: number): string {
  const parts =
    seconds >= 3600
      ? [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      : [Math.floor(seconds / 60), seconds % 60]
  return parts.map((part) => String(part).padStart(2, '0')).join(':')
}
