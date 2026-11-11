# UI integration

The replacement interface lives in `ui/`. It is a Vite + React + TypeScript app that uses the official shadcn CLI (`radix-nova`) and Tailwind CSS 4. The Electron main process loads `ui/dist/index.html` for both workspace and floating windows. Do not point production at the Vite dev server.

## Load the production bundle

1. Run `npm ci` and `npm ci --prefix ui` once. Root `npm start` and `npm run pack` both build the UI before launching or packaging.
2. `ui/dist/index.html` uses a relative base (`./`). `loadFile` on that HTML works without a dev server, a CDN, or `eval`.
3. Keep `ui/public/pcm-worklet.js` in the build output. The renderer loads it from `import.meta.env.BASE_URL`. Provenance: copied from `src/renderer/pcm-worklet.js`. The original file is unchanged.

## Bridge

`ui/src/bridge/types/api.ts` is the typed `window.workspace` contract. It only composes one interface per feature, and each feature file beside it holds that feature's methods and data shapes (for example `memory.ts` declares `MemoryApi` with `askMemory`, `transcribeMemory` and `onMemoryDelta`). `ui/src/bridge/index.ts` is the only adaptation module:

- If `window.workspace` exists, the UI uses it and reports `mode: 'native'`.
- Only an HTTP(S) loopback browser preview may use the mock when the bridge is absent. A missing bridge on a production file URL shows Workspace unavailable through an error boundary.
- A thrown native call is surfaced. The UI does not replace a failing native bridge with the mock.

The renderer never imports Electron or Node. It does not read tokens. Settings show only credential booleans. Preview copy does not contain API keys.

Subscribe methods return unsubscribe functions. The provider calls them on unmount. Generation and memory requests use `cancel(requestId)`. History consent is unchecked again after every Ask. Resume is a separate button and calls `resumeSession` only. It does not start audio. Answers are not written back into a session.

## CSP

The production HTML injects this policy at build time (dev does not, because Vite HMR needs a socket):

`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; media-src blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'`

`script-src` stays `'self'`. Radix writes inline style attributes, so production adds `style-src 'unsafe-inline'`. The native shell loads this bundled policy. `connect-src 'none'` blocks renderer HTTP/WebSocket calls. Provider HTTP traffic stays in main; the optional continuous voice feature uses WebRTC media and a data channel directly to OpenAI after main-side SDP negotiation.

## Dependencies (ui/package.json)

UI dependencies (build tools are development-only): React 19.3, react-dom 19.3, Tailwind CSS 4.3, `@tailwindcss/vite` 4.3, `shadcn` 4.22, `radix-ui` 1.8, `lucide-react` 1.60, `sonner` 2, `next-themes` 0.4, `class-variance-authority` 0.7, `tw-animate-css` 1.4, `@fontsource-variable/geist` 5.3, `cn` 0.5.

Dev: Vite 8.3, TypeScript 6, `@vitejs/plugin-react` 6, `@types/react` 19, `@types/react-dom` 19, `@types/node` 24, `oxlint` 1.88.

No CDN fonts. Geist Variable is bundled.

## What the mock does not prove

Browser preview uses fictional sessions, one pending tool, one handoff, and one disconnected connector. Catalog rows stay unavailable. Runtime install text says Homebrew was not run. Clipboard, sharing help, native system audio, and speech-asset management throw. ChatGPT login records a local preview account and is not a live session.

These remain unverified in real use: microphone capture, system audio, Accessibility and screen permissions, OAuth in the system browser, Homebrew installs, Apple Speech assets, screen capture, Teams concealment, save dialogs, and any paid provider.

## Post-build review

Question dictation now reuses the meeting capture adapter in microphone-only mode. This preserves the bundled `pcm-recorder` message/flush protocol, releases late microphone streams through the same generation guards, supports explicit Stop dictation, cancels pending transcript requests, discards late results and keeps asking as a separate action. Browser previews do not record microphones. Permission failures clear the busy state. Failed or cancelled memory answers are discarded.

`npm run ui:test` passes seven focused guard/lifecycle/audio tests without new dependencies. `npm run build` passes TypeScript and the production bundler. A separate Electron probe loaded `ui/dist/index.html` under context isolation and sandboxing with an in-memory fixture preload: it checked file-URL loading, 700px layout, missing-preload failure without mock data, and zero external network requests/normal-load console errors. See [probe evidence](UI_SANDBOX_VERIFICATION.json). This validates packaging boundaries, not production backend integration or real devices.

Independent browser review found no horizontal overflow or functional text below 11px on home, sessions, assistants, tools, settings and privacy at 700px. The integrated app uses the same native preload, URL checks and window privacy controller. The legacy renderer is excluded from the package. The `audio-capture` module is a shared production entry, allowing native synthetic PCM checks to exercise the actual UI adapter. Backend requests still run in the main process.

## Integrated verification

The packaged arm64 app passes 89 native checks with its real preload, SQLite, provider transport, native helpers and controlled loopback endpoints. These cover per-question history consent/reset, source review and explicit resume; escaped transcript and selection content; MCP tool reviews and OAuth; reviewed client configuration in an isolated fixture home; ChatGPT identity fixtures; independent translation settings; overlay delivery at 360px; and all main pages at 700/1280px. See [native evidence](native-verification.json). No paid provider or real meeting was used.

Root tests pass 52 backend cases and `npm run ui:test` passes seven UI cases. PCM and startup-cancellation tests now load the TypeScript production audio source, rather than the archived renderer. Root `npm run check` checks JavaScript syntax; `npm run ui:build` checks TypeScript. The Vite bundle-size advisory and six non-blocking lint warnings (hook dependencies and Fast Refresh exports) remain. Development-only shadcn CLI transitive advisories remain; `npm audit --prefix ui --omit=dev` reports zero production advisories. No CLI or UI node_modules are shipped.
