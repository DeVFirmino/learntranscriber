export function encodeWav(chunks: Int16Array[], sampleRate: number) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const buffer = new ArrayBuffer(44 + length * 2)
  const view = new DataView(buffer)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + length * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, length * 2, true)
  let offset = 44
  let peak = 0
  for (const chunk of chunks) {
    for (const value of chunk) {
      view.setInt16(offset, value, true)
      offset += 2
      peak = Math.max(peak, Math.abs(value))
    }
  }
  return { buffer, sampleCount: length, peak }
}

// PCM16 to the -1..1 floats the echo canceller takes, and back; values within range survive the round trip.
export function pcm16ToFloat32(samples: Int16Array) {
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] / 32768
  return out
}

export function float32ToPcm16(samples: Float32Array) {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32768)))
  return out
}

// The blocks of one drain as one run of samples.
export function joinPcm(chunks: Int16Array[]) {
  const samples = new Int16Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    samples.set(chunk, offset)
    offset += chunk.length
  }
  return samples
}
