import type { Aec3Module } from './aec3'
import { EchoReduction } from './echo-reduction'

// Loads WebRTC AEC3 on first use, as its own chunk. The wasm comes in as an inline asset and is handed to the
// module directly, so loading it needs no fetch; the page policy allows only the wasm compilation
// ('wasm-unsafe-eval').
type Aec3Factory = (config: { wasmBinary: Uint8Array }) => Promise<Aec3Module>

export function decodeDataUrl(url: string) {
  const comma = url.indexOf(',')
  if (!url.startsWith('data:') || !url.slice(0, comma).endsWith(';base64')) throw new Error('Invalid AEC3 wasm asset.')
  const text = atob(url.slice(comma + 1))
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
  return bytes
}

export async function loadAec3(): Promise<Aec3Module> {
  const [factory, wasm] = await Promise.all([
    import('@ennuicastr/webrtcaec3.js'),
    import('@ennuicastr/webrtcaec3.js/dist/webrtcaec3-0.3.0.wasm?inline'),
  ])
  const create = (factory.default ?? factory) as unknown as Aec3Factory
  return create({ wasmBinary: decodeDataUrl(wasm.default) })
}

// One echo-reduction instance per window, shared by its session recording.
export const echoReduction = new EchoReduction({ load: loadAec3 })
