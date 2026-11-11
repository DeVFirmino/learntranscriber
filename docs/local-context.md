# Managed local context safety

The managed llama-server route now uses its reported single-slot context capacity, measures the formatted prompt with the server tokenizer, and reserves response space before sending a generation. Automatic compaction can run below the user's estimated-history threshold when the actual prompt is too large. Launch tuning and real out-of-memory recovery still require validation.

The server starts with a per-model context capacity (defaulting to the validated `localContextSize` setting, 4096; supported range 512–131072) and `--parallel 1`. The Local models screen lets the user save a capacity on each imported language model. `/props` must report a valid capacity and one slot. Runtime state exposes requested/effective capacity, and leases propagate effective capacity to conversation, memory and voice requests. Changing a model's capacity requires stopping its server first.

For managed requests, `/apply-template` receives the same messages, tools and thinking options as completion. `/tokenize` counts the returned prompt; output reserves at most 512 tokens (384 for voice/compaction), capped at one quarter of capacity, plus a 128-token margin. These endpoints are documented in the [official llama.cpp server reference](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md). No new dependency was needed. Unknown/malformed capacity, unsupported measurement, missing tool definitions or oversized payloads fail closed. External custom/cloud routes retain their existing behavior. Managed screenshots reject until paired vision support is implemented.

Each tool continuation is checked again. An oversized result cannot trigger another inference. Older history can be compacted in up to four passes while retaining the newest eight entries. Local compaction measures complete selected entries and previous memory; it refuses an entry that cannot fit instead of advancing a checkpoint over truncated text. Original stored entries and search history remain untouched, and undo removes only compaction records. Summary/translation modes keep full-transcript semantics and may reject a transcript that cannot fit; map/reduce summarization is not implemented.

Cancellation is checked after awaited preparation and immediately before storing the user entry. Failed or cancelled preflight cannot append that entry; runtime leases release on failure. This does not roll back entries already accepted by a generation that later fails.

## Verification

Representative behavioral evidence in `test/context-capacity.test.cjs`:

| Requirement | Evidence |
| --- | --- |
| Requested/effective capacity and teardown | `owned runtime exposes the lower server capacity through state and leases` |
| Exact acceptance boundary and response reserve | `managed completion reserves output and accepts the exact tokenizer boundary` |
| No inference on overflow | `managed completion rejects tokenizer overflow before generation` |
| Recheck tools | `local completion rejects an oversized tool result before a second generation` |
| Compact below configured threshold | `actual prompt capacity triggers compaction below the configured threshold` |
| Preserve complete source/checkpoint | `oversized compaction source cannot advance a partially read checkpoint` |
| Fulfilled-preflight cancellation | `session preparation rejects cancellation delivered by the completed preflight` |

`npm test`: 98 passed, zero failed/skipped. `npm run ui:test`: 25 passed. The preceding `npm run ui:build` passed; this continuation changes no UI rendering/types. The isolated development Electron run uses synthetic audio, fake provider/server transports and a separate temporary profile. Its result is recorded in `local-context-integration.json`; it does not prove packaged runtime or real meeting behavior.

The [real cached-Qwen check](local-context-verification.json) previously confirmed requested/effective 2048, pre-inference rejection, two compaction passes, all 14 original synthetic entries preserved, and a final 922-token prompt. No audio or credentials were used in that check. That real model run was not repeated in this continuation because its code path was unchanged apart from cancellation guards.

On startup, a narrowly recognized context/KV allocation failure retries at half the requested capacity, rounded down to 256-token increments and bounded to two retries. The reduced capacity is saved on that model and shown in runtime status. Other startup failures do not trigger an automatic retry. This fallback has not been exercised against a real memory-constrained machine. Local vision projector import, hash verification, managed launch flags and image gating are also implemented; projector URL/catalog downloads and real vision inference remain open. Local live Whisper also now uses speech pre-roll, overlapping preview windows and final refinement, with language and vocabulary prompt settings; slower-model backlog and real-session accuracy remain unverified. The user's running package was not replaced.
