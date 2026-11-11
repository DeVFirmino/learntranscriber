// Dictation transcribes one short segment with the configured transcription provider.
function createDictation({ settings, transcribe }) {
  return { transcribe: (input, signal) => transcribe(input, settings(), signal) };
}
module.exports = { createDictation };
