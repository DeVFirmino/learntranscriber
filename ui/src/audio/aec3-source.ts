// The AEC3 build (@ennuicastr/webrtcaec3.js 0.3.0, dist/webrtcaec3-0.3.0.js) assigns its embedded wasm to an
// undeclared global. Strict ES module code, which the app bundle is, rejects that assignment. The bundler
// therefore replaces it with a declaration, and the app passes the same wasm itself (see aec3-module.ts). Any
// other build fails loudly instead of loading with a different binary.
const EMBEDDED = /^WebRtcAec3Wasm="data:application\/wasm;base64,[A-Za-z0-9+/=]+";$/m

export const AEC3_BUILD = /[\\/]@ennuicastr[\\/]webrtcaec3\.js[\\/]dist[\\/]webrtcaec3-0\.3\.0\.js$/

export function strictAec3Source(code: string) {
  if (!EMBEDDED.test(code)) throw new Error('The AEC3 build changed: its embedded wasm assignment was not found.')
  return code.replace(EMBEDDED, 'var WebRtcAec3Wasm;')
}
