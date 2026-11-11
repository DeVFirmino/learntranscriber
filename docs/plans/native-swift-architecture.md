# Native helpers: clean architecture plan

Branch: `refactor/native-swift`. Decisions taken on 2026-10-25: scope (c), Swift unit tests with Swift Testing, swift-argument-parser.

## Status

Steps 1 to 5 and 7 are done; the layout below is what `native/` now contains. `swift build -c release` and the Node characterization tests run with the Command Line Tools alone. `swift test` needs Xcode: the Command Line Tools ship Testing.framework but their `swift test` does not execute the suites (a deliberately failing test exits 0). With Xcode 27.1 selected (2026-10-26), `cd native && swift test` runs and passes the HelperKit, SpeechCore, SystemAudioCore, ContextCore and ContextHelper suites.

## Why

The three macOS helpers were written as single files with everything in `main`:

| File | Lines | What is mixed together |
| --- | --- | --- |
| `native/apple-speech/SpeechHelper.swift` | 476 | argument parsing, permission prompts, file recognition (SFSpeechRecognizer), live streaming with task rotation, the macOS 26 SpeechAnalyzer path, language asset install/release, capability queries, PCM decoding, two separate JSON writers, timeouts |
| `native/system-audio/SystemAudioHelper.swift` | 145 | ScreenCaptureKit setup, Float32 to PCM16 conversion, packet batching, stdin control loop, a self-test signal generator, JSON output |
| `native/context/ContextHelper.swift` | 103 | Accessibility selection, Vision OCR, a self-test image renderer, argument parsing, JSON output |

The same helpers are copied three times (`value(after:)`, JSON line writer, error type). Nothing is unit-tested; the only checks are the Node smoke and `--self-test` modes. `scripts/build-native.cjs` calls `swiftc` three times with long flag lists.

## Patterns, with sources

- **Swift package with library and executable targets.** One `native/Package.swift`; each helper becomes a thin executable target over library targets that hold the logic. This is the standard SwiftPM layout (`Sources/<Target>`, `Tests/<Target>`). Verified locally: `swift build -c release` works with the installed Command Line Tools (Swift 6.3.3).
- **Ports and adapters at the Apple-framework boundary.** Domain types and policies (PCM conversion, packet batching, task rotation limits, locale matching, event and response models) are plain Swift with no framework imports, so they can be tested. Apple frameworks (Speech, ScreenCaptureKit, Vision, Accessibility) sit behind small protocols, for example `SpeechRecognizing`, `AudioCapturing`, `TextRecognizing`. Protocol names follow the [Swift API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/): capabilities end in `-ing`/`-able`; side-effecting methods read as verbs, others as nouns.
- **Swift 6 strict concurrency.** Keep `-strict-concurrency=complete` and warnings-as-errors, now as `swiftSettings` in the package. Stateful engines are actors or `@MainActor` classes; framework callbacks hop onto them. One shared `withTimeout` helper replaces the three hand-written task groups.
- **Typed protocol output.** One `Codable` event and response model per helper and one `LineWriter` that writes JSON lines to stdout. The JSON field names and values stay identical, so `src/main` does not change.
- **Command-line parsing.** Option A uses [swift-argument-parser](https://github.com/apple/swift-argument-parser) (Apple, `from: "1.7.0"`) with one subcommand per mode, which removes the hand-rolled parsing and validates arguments. It is a new dependency, fetched once with SwiftPM. Option B is a small shared parser in our own target, with no dependency. See question 3.
- **Tests.** [Swift Testing](https://github.com/swiftlang/swift-testing) (`@Test`, `#expect`) ships with Swift 6 and Xcode 16, but **not with the Command Line Tools installed here**: `import Testing` and `import XCTest` both fail. See question 2.
- **Documentation comments on every declaration**, as the API Design Guidelines ask.

## Target layout

```text
native/
  Package.swift
  Sources/
    HelperKit/              # shared: LineWriter, HelperError, withTimeout, PCM16 helpers
    SpeechCore/             # pure: events/responses, PCM decoding, rotation policy, locale matching
    SpeechAdapters/         # SFSpeechRecognizer file + streaming engines, SpeechAnalyzer engine,
                            # AssetInventory manager, authorization
    SystemAudioCore/        # pure: Float32 -> PCM16, packet batching, self-test tone
    SystemAudioAdapters/    # ScreenCaptureKit stream
    ContextCore/            # pure: response model, 20 KB/20 MB bounds
    ContextAdapters/        # Accessibility selection, Vision OCR, self-test image
    apple-speech/           # @main: commands only (capabilities, recognize, session, assets)
    system-audio/           # @main: status, self-test, capture
    context-helper/         # @main: status, selection, ocr, self-test
  Tests/
    SpeechCoreTests/ SystemAudioCoreTests/ ContextCoreTests/ HelperKitTests/
```

Executables keep their current names and command-line flags (`--capabilities`, `--mode session`, `--list-assets`, `--status`, `--selection`, `--image`, `--self-test`, …) so the Electron side is untouched.

## Safety net before moving code

1. Characterization: add a Node test that runs each built helper in its permission-free modes (`--self-test`, `--status`, `--capabilities`, invalid arguments) and pins the exact JSON output. It runs before the refactor and must pass unchanged after it.
2. The existing smoke (`npm run smoke`) runs the helpers through Electron and stays green after every step.

## Steps (one commit each, all green)

1. Characterization tests for the three current binaries.
2. Create `native/Package.swift` and `HelperKit` (LineWriter, HelperError, argument helper, `withTimeout`); switch `build-native.cjs` to `swift build -c release` and copy the three products into `.local/native/`. The binaries are still built from the old code.
3. System audio: split into `SystemAudioCore` + `SystemAudioAdapters` + thin executable.
4. Context: split into `ContextCore` + `ContextAdapters` + thin executable.
5. Speech, in four commits: models and PCM decoding into `SpeechCore`; file recognition engines behind `SpeechRecognizing`; streaming session engine with its rotation policy; asset management and capabilities. Then the thin executable.
6. Unit tests for every Core target (depends on question 2).
7. Remove the old single files, update `docs/reviews/architecture-plan.md` and the packaging notes in `todo.md`.

Each step ends with: `npm run native:build`, characterization tests, `npm test`, `npm run smoke`.

## Out of scope unless chosen in question 1

The JavaScript side already went through the 29-slice refactor, but several files still use a dense one-line style that is hard to read (`store.cjs` has lines up to 835 characters, `local-models.cjs` up to 856, `settings.tsx` up to 574, `composition.cjs` up to 524), and there is no formatter or linter for `src/main`.

## Open questions

1. Scope: (a) Swift helpers only; (b) Swift helpers, then a readability pass on the JavaScript (formatter, split the long lines and dense files like `store.cjs`, `local-models.cjs`, `settings.tsx`); (c) everything in (b) plus a linter that blocks the dense style in CI.
2. Swift unit tests: (a) install Xcode so Swift Testing works (about 3 GB+, most standard); (b) add Swift Testing as a package dependency built from source (no Xcode, one more dependency); (c) no Swift unit tests, rely on the Node characterization tests and smoke only.
3. Argument parsing: (a) swift-argument-parser (Apple, new dependency); (b) small parser of our own in `HelperKit`.
