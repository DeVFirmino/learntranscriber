# Local workflow completion

Local workflow features implemented on 2026-10-22. Verification boundaries are recorded below.

## Behavior and controls

| Feature | Contract |
| --- | --- |
| Context compaction | Session memory can be compacted manually or with `/compact`, inspected and undone one revision at a time. Automatic compaction is opt-in. Estimates use characters/4, not the model tokenizer. The latest eight entries remain in active context and original entries remain searchable. Managed local input is processed in bounded batches; redundant text can use exact sentence de-duplication. Model summaries remain fallible. |
| Recording reminder | Opt-in reminder after 30 minutes; Continue renews the interval. After 60 unanswered seconds, recording stops and pending audio finishes. |
| Protected Notch | Opt-in 84×48 native button during an active session; expands to 400×260 with insight navigation, Ask and Capture. Native capture protection applies before presentation. Click-through never disables this recovery button. |
| Shortcuts | 22 definitions with configurable accelerators, enabled state, validation, duplicate detection and OS registration status. Existing recovery shortcuts remain enabled; new actions default off. Menu and recovery labels reflect configuration. |
| KV cache | Off uses runtime defaults; Moderate uses Q8 keys/values; Aggressive uses Q8 keys/Q4 values. Applies when starting the local LLM. The initial Q4-key/value experiment produced gibberish and was rejected. |
| Auto-scroll | Follows new transcript/answer content; scrolling upward pauses following, returning near the bottom resumes. |
| Quick screenshot | Off by default. Normally capture attaches an image for review; enabling immediate analysis sends a capture to the configured provider. |
| Copied selection | Off by default and disabled while concealed. New clipboard text must match a selected passage in another app before analysis. Foreign-app compatibility still requires a manual test. |
| Local discovery | Explicit checks of 127.0.0.1:11434 and :1234 only. No credentials or redirects; bounded replies/timeouts. Provider selection changes only after Use. |
| Progressive captions | Select Local Whisper and enable live captions. Independent mono 16 kHz ME/THEY buffers, provisional drafts, silence/12-second finalization, bounded queued work. Only final text is stored. This is progressive local inference, not a remote Realtime protocol implementation. |
| Optional Gemini audio | Explicit provider selection, configured audio-capable model, inline audio, no stored interaction. Transport tested with fixtures only; no live Gemini request or paid API was used. |

## Verification

- Backend: 85 tests passed; renderer: 25 tests passed. JavaScript syntax, TypeScript/Vite build and strict Swift 6 helper builds passed.
- [Real models](productivity-model-verification.json): verified multilingual Whisper tiny and Qwen3 0.6B, provisional/final captions, preserved original entries, exact de-duplication, and usable Moderate/Aggressive KV outputs. Generated speech was a file fixture, not a microphone test. Recognition contains an error and does not establish accuracy for arbitrary speech.
- [Packaged Electron verification](productivity-packaged-verification.json): 133 checks passed. The earlier [development checkpoint](productivity-native-verification.json) passed 132 checks before the short-voice flush correction. The final fixture waits for non-silent worklet PCM instead of assuming startup completes within 350 ms. Smoke output is cleared before each run, and timeouts cannot reuse stale results.
- Electron smoke checks use isolated data, synthetic microphone streams and controlled loopback providers. They exercise production IPC, worklets, persistence and native window metadata; they do not test a user's microphone or a remote meeting.
- Responsive screenshots cover 1280, 1024, 768, 390 and 320 pixels. A settings tab-height overlap was corrected. The static design scan reported no findings; no ignores were added. Existing six lint warnings and the bundle-size advisory remain.

## Local review package

The review application is built separately at `dist/local-parity/mac-arm64/LearnTranscriber.app`. It is unsigned and unnotarized. The existing `dist/mac-arm64` package and running app were preserved because their recording state was unknown. Models and credentials were not copied from another app or a user profile.

A local visual board was reviewed. Browser screenshots use clearly labeled sample data. Notch native images use internal web-content capture and do not prove exclusion from external screen capture.

## Remaining boundaries

Actual AirPods speech inside Electron, incoming meeting audio, long-running latency and Teams attendee-view exclusion remain unverified. Electron warns that ScreenCaptureKit can include protected windows. Hiding a window does not stop meeting recording.

Google, Notion and Obsidian integrations are excluded by request. Dedicated email delivery and service-specific configuration are deferred; generic reviewed MCP connections remain available. The optional cloud history voice path is separate from local live meeting captions and still needs a real provider test.

## Sources

- [Electron content protection limitations](https://www.electronjs.org/docs/latest/api/browser-window#winsetcontentprotectionenable-macos-windows)
- [Ollama local model inventory](https://docs.ollama.com/api/tags)
- [LM Studio model inventory](https://lmstudio.ai/docs/developer/openai-compat/models)
- [llama.cpp server](https://github.com/ggml-org/llama.cpp/tree/master/tools/server)
- [Gemini audio inputs](https://ai.google.dev/gemini-api/docs/audio)
- [Gemini interaction lifecycle](https://ai.google.dev/api/interactions-api)
