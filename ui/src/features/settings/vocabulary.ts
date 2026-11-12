// The settings validator's limit for transcriptionPrompt; local Whisper and cloud realtime transcription both read it.
export const VOCABULARY_LIMIT = 2000

// What a blurred edit should save: trimmed and capped to the validator's limit. Null means nothing to save, either
// the field is untouched or the trimmed text already matches what is stored.
export function vocabularyEdit(text: string, saved: string): string | null {
  const next = text.trim().slice(0, VOCABULARY_LIMIT)
  return next === saved ? null : next
}
