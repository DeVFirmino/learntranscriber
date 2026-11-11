// A block worth processing has samples.
export const usable = (samples: Float32Array | null | undefined): samples is Float32Array =>
  samples instanceof Float32Array && samples.length > 0

// Two blocks as one, either of which may be missing.
export function append(first: Float32Array | null, second: Float32Array | null) {
  if (!first) return second
  if (!second) return first
  const joined = new Float32Array(first.length + second.length)
  joined.set(first, 0)
  joined.set(second, first.length)
  return joined
}
