# Real-model validation — 2026-10-25

Free local models on this Mac (Apple Silicon, 18 GB), driven through the app's own `LocalModels`, `Providers`, session and live-transcription code. Runtimes: llama-server 0.7.0 and whisper-server 1.9.5 from Homebrew. Speech was synthesized with macOS `say`; no microphone, paid API or credential was used. Raw results are in [real-model-validation.json](real-model-validation.json).

| PG | Model | Result | Fix |
| --- | --- | --- | --- |
| PG-01 | Qwen3 0.6B Q8_0 | Tokenizer preflight, output reserve and automatic compaction still hold on the current code. A request for 131,072 tokens ran at the model's trained 40,960, and settings did not say so. A startup failure that is not an allocation error left the saved context untouched. | Settings now explains the capped context, in each interface language. |
| PG-02 | SmolVLM 256M + projector | The catalog pair downloaded, verified and started with its projector. It named a red and a blue image correctly. A text-only route refused an image. | None needed. |
| PG-03 | Whisper tiny | Two speakers at real-time pace for 61 s: word error rate 2.7% (THEY) and 0% (ME), no backlog. 147 s of speech with no one-second pause: 71.7% for THEY, because each 60 s utterance failed the 16 s native WAV bound and fell back to stitched previews. | Live utterances use their own 60 s bound; the same run now gives 2.5%. |
| PG-05 | Qwen3 0.6B | System prompt, realtime prompt (insight only), knowledge and a plain control reach and steer the model. The follow-up prompt shaped 4 of 11 suggestions over five runs. | Follow-up guidance now comes before the output rules: 6 of 6 over three runs. |
| PG-09 | Qwen3 0.6B, ten runs per request | Valid builder replies were rejected for a trailing full stop or sentence around the JSON, camelCase keys, a certainty flag sent as text, a message-only reply and a name passed as an ID. After those fixes and one example per common request: search 10/10, follow-up prompt 9/10 (0/10 without the examples), create 6/10, a correct unconfirmed delete 5/10. The rest are model errors: wrong command, missing system prompt, broken JSON, or `confirmed: true` with a claim that the deletion already happened. | Tolerant reply parsing and argument names; builder prompt examples. Deletion still needs your click and never removes a built-in. |
| PG-16 | Qwen3 0.6B, 4,096 context | A short summary and rewrite work. A 38,000-character meeting could not be summarized: the summary always sent the whole transcript and never compacted. | Past the window, a summary reads session memory and compacts like chat; the same meeting now summarizes. |
| PG-17 | SmolVLM 256M, 500M, SmolVLM2 2.2B | Two to four screenshots reach the server in order: prompt tokens grow by exactly 134 per image. With the question before the images, every model described one image of a pair; SmolVLM2 2.2B once said there were none. | Images now go before the question, labelled in order. SmolVLM2 2.2B then named both colours in either order and is offered as a starter model; 256M and 500M still describe one image. |

## Assistant email prompt

`email_prompt` was saved by the editor but no inference path read it. The session summary tab now drafts an email guided by it, or by a TL;DR default, and opens the memory email review card; the draft is saved unsent. With Qwen3 0.6B, the first instruction showed the format with placeholders and the model copied them; a plainer instruction gave a Subject line and a summary of its own. A prompt asking for Brazilian Portuguese produced Portuguese drafts in two of two runs.

## Not established

- **Model quality.** The 0.6B rewrite ignored "three bullet points" and invented outcomes; this measures the pipeline, not answer quality.
- **Out-of-memory fallback.** It was not reproduced: the server caps the slot at the trained context before memory runs out.
- **PG-04.** The terminal-launched `apple-speech` has no usage description, so speech authorization must be granted through the app with the user present.
