// The bar's launch intro stays at least this long so it never flickers, and never longer than the cap, so a slow
// start still reaches a usable bar.
export const INTRO_MIN_MS = 1900
export const INTRO_MAX_MS = 4000

export function introDone(elapsedMs: number, ready: boolean): boolean {
  return elapsedMs >= INTRO_MAX_MS || (ready && elapsedMs >= INTRO_MIN_MS)
}
