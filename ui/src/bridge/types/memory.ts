// Dictation: a short WAV segment becomes editable text for a question box. It is never saved as a transcript.
export interface MemoryApi {
  transcribeMemory: (input: { requestId: string; mime: string; bytes: ArrayBuffer }) => Promise<string>
}
