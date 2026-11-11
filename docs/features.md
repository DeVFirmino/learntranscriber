# Feature inventory

On 2026-11-02 the Connections feature (MCP tools, external-agent handoff, Obsidian discovery and summary delivery) and email sending were removed; their rows and sections below are gone.

“Implemented” describes this application's code path; “verified” describes the actual checks performed.

## Implementation and verification

| Feature | This build | Verification |
|---|---|---|
| Separate desktop workspace | Implemented | Native renderer and packaged launch |
| Capture-protection request | Applied to all registered windows before showing | Native `isContentProtected()` before and after toggles; not an attendee-view test |
| Hide Dock / app-switcher entry | macOS accessory activation policy | Native Dock visibility hides and restores |
| Emergency hide / restore | Global shortcut and menu-bar control | Both windows hide; settings and new windows cannot reveal them; only previously visible windows restore |
| Floating assistant | Dedicated window, updates from generated responses | Native render and response delivery |
| Opacity | Native overlay opacity | Native getter checked |
| Always on top / all Spaces | Configured on the overlay | Code path present; full-screen applications and multi-display behavior require manual checks |
| Click-through with recovery | Native mouse-event forwarding; shortcut/menu toggle | Controller routing checked; manual pointer interaction still needed |
| Recovery shortcuts | Registered globally; unavailable shortcuts are identified in the UI | Registration runs in native app; not all physical key sequences exercised |
| Conversation history | SQLite with FTS5, local persistence and cascade deletion | Restart, transcript search, export contents and deletion tests |
| Resume / end sessions | Implemented through the native bridge | Store and native session flows exercised |
| Assistant creation / editing | Persisted custom instructions and selection | Native app code; focused manual UI review pending |
| OpenAI / OpenRouter / custom providers | Streaming Chat Completions-compatible transport | Controlled local HTTP provider and stream-framing tests; no live paid provider calls |
| Gemini | Native streaming transport | Controlled request/response contract test; live key/model pending |
| Provider model discovery | Configured provider catalog | Loopback model endpoint exercised |
| Provider credentials | Encrypted BLOB via Electron safeStorage | No user credentials entered; Keychain prompts and upgrade identity need testing with the user's build identity |
| Transcript context and chat | Grounded in the selected session | Native IPC → HTTP fixture → persisted reply |
| Summary and translation | Separate persisted bulk generation plus temporary per-message transcript translation | Summary and independently configured translation native flows tested with fixtures; per-message backend guards and browser mock tested; live content review pending |
| Microphone and system audio | Explicit opt-in capture, separate ME/THEY streams; native ScreenCaptureKit audio-only helper and Electron loopback choices | Native helper compilation, PCM/WAV pipe framing, synthetic signal and renderer IPC transcription passed; actual microphone, native permission prompts and meeting audio remain unverified. No CoreAudio driver is installed |
| Segmented transcription | Independent approximately eight-second segments, bounded queue and in-memory retry | Real AudioWorklet generated-signal PCM WAV flush and upload verified; no real-speech accuracy test |
| Explicit display capture | Selected-display PNG attached to the next question | Implementation present; needs Screen Recording permission and manual check |
| Clipboard context | Read only after an explicit Paste clipboard action | Code path present |
| Automatic transcript insights | On by default while listening; requested on a question from the other speaker, your pause after speaking, or a periodic check, per the chosen mode (default proactive) | Scheduler tested; real-conversation behavior pending |
| Local compatible servers | Custom analysis and transcription endpoints | Controlled loopback provider verified |
| Apple Speech | Modern SpeechTranscriber when its assets are installed on macOS 26; legacy on-device SFSpeechRecognizer otherwise; language listing/install/reserve/release UI | Permission-free inventory and real reserve/release of an already-installed en_US language passed. Actual recognition authorization and a new language download remain untested |
| Managed Whisper / LLM models | Import/copy, HTTPS download with publisher SHA-256, verify/delete, user-selected runtime, explicit start/stop, loopback readiness and idle shutdown | Actual Whisper tiny.en/JFK recognition passed; lifecycle tests and native IPC fixtures cover both types. Starter catalog and Homebrew runtime installer included; Homebrew itself is required and not installed automatically |
| Selected text and OCR context | Local Apple Vision OCR, explicit selection shortcut, opt-in new-selection detection and editable preview for the next question | Actual OCR on a synthetic image and the native fixture window passed; deduplication, late-result discard and permission failures tested. Foreign-app selection compatibility still needs manual validation |
| Dictation | Integrated | A short WAV segment becomes editable text in the question boxes, never a transcript; synthetic PCM dictation is exercised through native IPC. The history assistant (typed and voice questions about saved sessions) was removed from the product on 2026-11-05 at the owner's request, and its backend on 2026-11-08 |
| Commercial subscriptions and referrals | Omitted from the personal build | No use of the original service's entitlements or credentials |

## Local workflow additions — 2026-10-22

The local pass adds reversible context compaction, a recording reminder, a protected Notch launcher, configurable shortcuts, KV cache modes, opt-in quick capture/copied-selection analysis, auto-scroll, explicit local-server discovery and progressive Whisper captions. See [contracts, evidence and remaining boundaries](local-productivity.md). Earlier verification rows describe their original checkpoints; they are not evidence for these later additions.

## Teams compatibility boundary

Content protection and Dock/window-behavior changes are a known implementation technique for excluding capture, not proof that a particular Teams capture excludes these windows. Focused REA Evidence: `ev_144fc30dd61ebac4c58fba4ff457aa414fc0b520a4827e0f54597bd0e9565c48`; see the retained summary. Its five-file inventory is complete within that subset; semantic coverage remains unknown, including 986 unresolved observations.

[Electron documents](https://www.electronjs.org/docs/latest/api/browser-window#winsetcontentprotectionenable-macos-windows) that macOS ScreenCaptureKit may capture protected windows. This app therefore labels capture protection as requested and Teams compatibility as unverified. It provides actual window hiding as a separate operation. No Teams settings, policies or running meetings were changed during implementation.

Hiding the workspace or Dock does not stop an explicitly started audio recording. Stop listening to stop capture. Before relying on exclusion, test the actual Teams version and sharing mode from an attendee view, including whole-display capture separately from window sharing.

## Technical sources

- [Electron window controls](https://www.electronjs.org/docs/latest/api/browser-window)
- [macOS activation policies](https://www.electronjs.org/docs/latest/api/app#appsetactivationpolicypolicy-macos)
- [Electron secure storage](https://www.electronjs.org/docs/latest/api/safe-storage)
- [macOS desktop audio requirements](https://www.electronjs.org/docs/latest/api/desktop-capturer#macos-versions-142-or-higher)
- [OpenAI chat API](https://developers.openai.com/api/reference/resources/chat)
- [OpenAI transcription API](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create)
- [Gemini generation API](https://ai.google.dev/api/generate-content)
- [OpenRouter API](https://openrouter.ai/docs/api_reference/overview)

## Dock regression

The native smoke test initially reproduced a Dock visibility failure during fast startup changes. A minimal native probe confirmed synchronous `app.setActivationPolicy('accessory' / 'regular')` changes visibility reliably in this environment. The implementation centralizes that application-wide policy, avoids per-window taskbar mutation on macOS, and bypasses overlay process-type transformations. Native tests retain the hide/restore regression and concealment checks. This does not assert that every asynchronous Dock timing issue is explained by one cause.

## Native helpers

The bundled helper requires an Apple Silicon Mac and a Swift toolchain to build. Apple Speech requests authorization only for transcription and refuses a cloud fallback when on-device recognition is unavailable.

- [Apple Speech framework](https://developer.apple.com/documentation/speech)

## Managed local model verification

The local model manager uses separately chosen llama.cpp/whisper.cpp server executables, installed independently rather than bundled with the app. Downloaded models require a publisher SHA-256 digest; imported originals are preserved. Models are capped at 32 GB. Runtime startup is explicit, supports one server per type and waits for readiness before routing inference. Active request leases prevent idle shutdown. Servers stop when the app quits. Stored custom-provider keys are not sent to managed local endpoints.

[Actual Whisper verification](local-runtime-verification.json) covers a verified 77,704,715-byte tiny.en model, public JFK sample recognition and process stop. Native integration uses lightweight server fixtures. Real Qwen3 0.6B inference now passes through the manager and provider transport; microphones, actual system audio and long meetings remain unverified.

- [llama.cpp server documentation](https://github.com/ggml-org/llama.cpp/tree/master/tools/server)
- [whisper.cpp server documentation](https://github.com/ggml-org/whisper.cpp/tree/master/examples/server)

## Context boundaries

Selection detection defaults to off. It runs only for an active session while windows are not emergency-hidden, ignores the initial selection, deduplicates changes and discards results from an ended/replaced session. Its native helper reads the focused Accessibility element’s selected text, excludes this app and refuses standard secure text fields. Some apps may not expose selections. Command–Shift–K reads the focused application before returning to the workspace. Screen OCR is explicit and local; automatic selection alone never captures screenshots. A separate explicit opt-in enables screenshot+selection analysis, at most once per 15 seconds. It stops scheduling when the session ends or windows are emergency-hidden; disabling it cancels pending automatic requests. Without automatic screen analysis, the editable text preview is sent only with an explicit question. Selection text is not automatically inserted into persisted session context. Generated answers can contain that text.

On macOS 26, language assets are managed through Apple AssetInventory. Existing reservations are not evicted automatically. End the active session before asset mutation. Release removes this app’s reservation; shared OS files may remain. Stop waiting terminates the helper wait and does not prove that an OS-managed download stopped. Older macOS versions keep the legacy recognition path and report managed assets unavailable.

See [context and asset verification](context-verification.json).

## Remaining-work implementation update

- **Native incoming audio:** a bundled Swift ScreenCaptureKit helper requests an audio-only output, excludes this app where possible, converts mono 16 kHz float audio to PCM and emits bounded packets. The main process wraps WAV and uses the existing transcription/retry path. Start/stop follows the listening controls; final PCM is flushed and child processes are stopped on quit. Permission-free status and synthetic signal tests do not exercise real system capture. This is a native capture alternative that avoids a virtual audio driver or physical-output-device routing.
- **Runtime installation:** Homebrew installs a fixed `llama.cpp` or `whisper-cpp` formula with automatic updates/cleanup disabled, then registers the resulting server executable. Required formula dependencies may be installed. No command shell or user-supplied package command is used. Existing runtime registration was verified; a fresh installation and cancellation during an actual package download remain untested. See [installer verification](runtime-installer-verification.json).
- **Automatic visual insights:** separately opt-in, selection-driven and rate limited. It captures the configured display and sends screenshot+selected text to the configured provider during an active session. Chat requests take priority. This behavior is not enabled by the simpler selection-preview switch.
- **ChatGPT plan login:** direct registration uses this app’s actual name, stable host ID, state, nonce and PKCE. The issued client ID is exchanged and retained with a signature-validated subject. Multiple registrations remain separate; only validated authorization becomes active. Issuer/audience/expiry/nonce and plan-usage scopes are checked. Tokens stay encrypted in main-process storage. Refreshes serialize per account and credential writes serialize across accounts. Logout attempts remote refresh-token revocation before clearing tokens locally. Remote failure is disclosed. Inference uses public `/v1/responses`, `store: false`, streaming and a mandatory `response.completed`; partial/failed streams are not successful answers. Live user authentication, entitlements and provider charging are not established by fixtures.

Original visual equivalence, a real Teams attendee-view test, real microphone/incoming audio, long-session recovery, production signing/notarization, and live external accounts still require separate validation. No claim of complete behavioral parity follows from these implementations.

Sources for implementation contracts:

- [Apple ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos)
- [OpenAI ChatGPT registration](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [OpenAI account renewal/revocation](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)
- [OpenAI ChatGPT inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling)
- [Qwen model publisher](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF)
- [Whisper model publisher](https://huggingface.co/ggerganov/whisper.cpp)

## Memory backend and separate UI migration

The approved React/Tailwind/shadcn UI is integrated into the packaged workspace and overlay. Its native tools and settings flows are covered by the packaged smoke suite. See [UI integration](UI_INTEGRATION.md). Actual email/Obsidian summary delivery remains open.

## Real local LLM verification

[Qwen runtime evidence](local-llm-verification.json) confirms the installed `/opt/homebrew/bin/llama-server` loaded the starter Qwen3 0.6B Q8 model (639,446,688 bytes) after publisher SHA-256 verification. A synthetic prompt produced the expected marker through streaming provider transport; saved credentials were not read, and the owned server stopped afterward. This does not establish answer quality, long-session reliability or native UI integration. Model bytes remain in ignored local test storage. No new runtime package was installed for this check.

## Unified stealth mode

A single switch now forces capture protection, hides Dock/app-switcher identity and clears native titles, preserving individual preferences for exit. Protection/title state is reasserted across window lifecycle events. Menu icon hiding includes a restore-shortcut fallback. Native macOS metadata and optional Orca discovery checks pass in the development build; real meeting exclusion and package review remain pending. See [stealth mode](stealth-mode.md).
