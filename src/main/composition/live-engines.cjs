const { createLocalLiveTranscription } = require('../application/audio/local-live-transcription.cjs');
const { RealtimeTranscription } = require('../infrastructure/providers/realtime-transcription.cjs');
const { GeminiLiveTranscription } = require('../infrastructure/providers/gemini-live-transcription.cjs');
const { AppleSpeechSessions } = require('../infrastructure/native/apple-speech-sessions.cjs');
const { createCaptionPublisher } = require('../application/audio/caption-publication.cjs');

// Builds the live transcription engines (local Whisper, OpenAI Realtime, Gemini Live and Apple speech), which all
// publish their captions through one publisher.
function createLiveEngines({ repositories, localModels, vault, nativeSpeech, transcribe, speech, fanOut, changed }) {
  const { settings, sessions, entries } = repositories;
  const transcripts = { settings, sessions, entries };
  const publishCaption = createCaptionPublisher({ speech, broadcast: fanOut.broadcast, changed });
  return {
    whisper: createLocalLiveTranscription({
      ...transcripts,
      models: localModels,
      transcribe,
      onCaption: publishCaption,
    }),
    realtime: new RealtimeTranscription(transcripts, async () => vault.read('openai'), publishCaption),
    gemini: new GeminiLiveTranscription(transcripts, async () => vault.read('gemini'), publishCaption),
    apple: new AppleSpeechSessions(transcripts, nativeSpeech.executable, publishCaption, {
      preflight: (locale) => nativeSpeech.capabilities(locale),
      onReady: (locale) => nativeSpeech.recordLocaleUsage(locale),
    }),
  };
}
module.exports = { createLiveEngines };
