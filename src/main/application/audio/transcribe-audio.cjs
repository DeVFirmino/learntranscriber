const { validateTranscriptionInput, withoutBlankAudio } = require('../../domain/audio/transcription-input.cjs');

// Transcribes audio bytes with the configured engine: the managed local Whisper (through a runtime lease), Apple
// Speech, or a cloud provider.
function createAudioTranscriber({ acquireWhisper, whisper, appleSpeech, providers }) {
  async function engineTranscript(bytes, input, settings, signal) {
    if (settings.transcriptionProvider === 'apple')
      return appleSpeech.transcribe(bytes, settings.appleSpeechLocale, signal);
    if (settings.transcriptionProvider !== 'local') return providers.transcribe(settings, bytes, input.mime, signal);
    const lease = acquireWhisper();
    try {
      return await whisper({ base: lease.base, bytes, settings, signal });
    } finally {
      lease.release();
    }
  }
  return {
    async transcribe(input, settings, signal) {
      validateTranscriptionInput(input, settings.transcriptionProvider);
      return withoutBlankAudio(await engineTranscript(Buffer.from(input.bytes), input, settings, signal));
    },
  };
}
module.exports = { createAudioTranscriber };
