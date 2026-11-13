// How an audio or video file becomes transcript lines: decoded to 16 kHz mono, then cut into chunks short enough for
// every transcription engine and small enough for one request each.
export const FILE_SAMPLE_RATE = 16000
export const CHUNK_SECONDS = 30
// Long lectures fit; a longer file is refused before any decoding work starts.
export const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024

// Sample ranges of at most CHUNK_SECONDS each, covering every sample once.
export function chunkRanges(sampleCount: number, sampleRate = FILE_SAMPLE_RATE, seconds = CHUNK_SECONDS) {
  const size = Math.max(1, Math.round(sampleRate * seconds))
  const ranges: { start: number; end: number }[] = []
  for (let start = 0; start < sampleCount; start += size)
    ranges.push({ start, end: Math.min(sampleCount, start + size) })
  return ranges
}

// The session takes the file's name without its extension, trimmed to the title limit.
export function fileSessionTitle(fileName: string) {
  const base = fileName
    .replace(/\.[^./\\]{1,8}$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return (base || 'Audio file').slice(0, 80)
}

// A stable id per chunk, so a retry of the same chunk joins or returns the first attempt instead of adding a line.
export function chunkSegmentId(sessionId: string, index: number) {
  return `file-${sessionId.slice(0, 40)}-${index}`
}
