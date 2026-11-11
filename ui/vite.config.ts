import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { AEC3_BUILD, strictAec3Source } from './src/audio/aec3-source.ts'

const root = path.dirname(fileURLToPath(import.meta.url))

function productionCsp(): Plugin {
  const policy = [
    "default-src 'self'",
    // WebRTC AEC3 (echo reduction) is WebAssembly; compiling it is the only dynamic code allowed.
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'none'",
    // The Home loop is a packaged video; recordings play from blobs.
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
  return {
    name: 'production-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}">`)
    },
  }
}

// Declares the AEC3 build's wasm global so the module also runs as strict code (see src/audio/aec3-source.ts).
function strictAec3(): Plugin {
  return {
    name: 'strict-aec3',
    transform(code, id) {
      return AEC3_BUILD.test(id) ? { code: strictAec3Source(code), map: null } : null
    },
  }
}

export default defineConfig({
  base: './',
  // The AEC3 wasm is imported as an inline asset (src/audio/aec3-module.ts), so loading it needs no fetch.
  assetsInclude: ['**/*.wasm'],
  build: {
    rolldownOptions: {
      input: { index: path.resolve(root, 'index.html'), 'audio-capture': path.resolve(root, 'src/audio/capture.ts') },
      output: { entryFileNames: 'assets/[name].js' },
    },
  },
  plugins: [react(), tailwindcss(), productionCsp(), strictAec3()],
  resolve: {
    alias: {
      '@': path.resolve(root, './src'),
    },
  },
})
