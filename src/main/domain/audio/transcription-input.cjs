const MIMES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];

// Audio bytes one engine can transcribe: up to 20 MB in a supported container, WAV for Apple Speech and Whisper.
function validateTranscriptionInput(input, provider) {
  if (!(input?.bytes instanceof ArrayBuffer) || !input.bytes.byteLength || input.bytes.byteLength > 20000000)
    throw new Error('Audio segment must be between 1 byte and 20 MB.');
  if (!MIMES.includes(input.mime)) throw new Error('Unsupported audio format.');
  if (provider === 'apple' && input.mime !== 'audio/wav')
    throw new Error('Apple Speech requires WAV audio. Restart listening to use PCM capture.');
  if (provider === 'local' && input.mime !== 'audio/wav') throw new Error('Local Whisper requires WAV audio.');
}

// Whisper marks silence as [BLANK_AUDIO]; that is no transcript.
const withoutBlankAudio = (content) => (/^\[BLANK_AUDIO\]$/i.test(content) ? '' : content);

module.exports = { validateTranscriptionInput, withoutBlankAudio };
