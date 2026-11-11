// Older saved scales must not make floating text smaller than the readable base.
export function floatingFontScale(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(1.6, value)) : 1
}

export function floatingFontSize(value: number): number {
  return 18 * floatingFontScale(value)
}
