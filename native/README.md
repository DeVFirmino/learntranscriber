# Native helpers

Three small macOS executables the desktop app launches as child processes and talks to over JSON lines on stdout. They are built from this Swift package by `npm run native:build`, which copies the products to `.local/native/` for the app and the packager.

| Product | What it does | Layers |
| --- | --- | --- |
| `apple-speech` | capabilities, language assets, file transcription, live sessions | `SpeechCore` (models, rotation and partial-text rules), `SpeechAdapters` (Speech, SpeechAnalyzer, AssetInventory) |
| `system-audio` | status, device list, self-test tone, system audio capture as PCM16 packets (ScreenCaptureKit or `--process-tap`) | `SystemAudioCore` (packet rules, capture events, capture session), `SystemAudioAdapters` (ScreenCaptureKit, Core Audio process tap and device queries) |
| `context-helper` | Accessibility status, selected text, Vision OCR | `ContextCore` (bounds, response), `ContextAdapters` (Accessibility, Vision) |

`HelperKit` is shared by every layer: the JSON line writer, `HelperError`, `withTimeout`, `StandardInputReader` and PCM16 conversion. `CommandKit` is shared by the three commands only: the ArgumentParser glue, that is the common command ending (`--help` exits 0; usage mistakes and failures become one JSON error line and exit 1) and the raw-argument rules (the first of a repeated option wins).

Rules: Core targets import no Apple framework, depend on `HelperKit` at most (never on ArgumentParser) and are unit-tested; adapters sit behind small protocols (`AudioCapturing`, `SelectionReading`, `TextRecognizing`, `FileRecognizing`, `SessionEventSink`); every target builds with strict concurrency and warnings as errors; flags, messages and exit codes are pinned by `test/native-helpers.test.cjs`.

```sh
swift build -c release   # products in .build/release
swift test               # needs Xcode; see docs/plans/native-swift-architecture.md
```
