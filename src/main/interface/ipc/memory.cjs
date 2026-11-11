const { text } = require('../../domain/shared/text.cjs');

// Dictation turns a short WAV segment into editable text for the question boxes; it never becomes a transcript.
function registerMemory(handle, { requests, dictation }) {
  handle('memory:transcribe', (event, input) => {
    if (input?.mime !== 'audio/wav' || !(input.bytes instanceof ArrayBuffer) || input.bytes.byteLength > 2000000)
      throw new Error('Dictation requires a WAV segment under 2 MB.');
    const id = text(input.requestId, 100);
    return requests.run({ id, owner: event.sender.id, mode: 'dictation', timeoutMs: 90000 }, (signal) =>
      dictation.transcribe(input, signal),
    );
  });
}
module.exports = { registerMemory };
