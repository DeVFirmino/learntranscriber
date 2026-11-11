// A fixed skyline so the bars read as a voice rather than one block; every bar scales with the measured level.
const SHAPE = [0.35, 0.6, 0.85, 0.5, 1, 0.7, 0.45, 0.9, 0.6, 0.8, 0.4, 0.95, 0.55, 0.3]

// Bar heights in percent for a level between 0 and 1, with a floor so a silent microphone still shows its bars.
export function levelBars(level: number): number[] {
  const clamped = Math.min(1, Math.max(0, level))
  return SHAPE.map((shape) => Math.round(12 + 88 * clamped * shape))
}
