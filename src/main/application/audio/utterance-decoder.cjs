const { wav } = require('../../domain/audio/wav.cjs');
const { MAX_UTTERANCE_BYTES } = require('../../domain/audio/utterance-segmenter.cjs');

// A decoded line worth showing: some letters, not Whisper's blank or bracketed noise markers.
function validTranscript(value) {
  return Boolean(
    value &&
    value.trim() &&
    !/^\[BLANK_AUDIO\]$/i.test(value) &&
    /\p{L}/u.test(value) &&
    !/^\s*[[(].*[)\]]\s*$/u.test(value),
  );
}

/**
 * Decodes one live session's utterances in order per speaker: preview windows (dropped when two are waiting) and
 * finals (refused when four are waiting). A final decode that fails or hears nothing keeps the latest preview.
 */
function createUtteranceDecoder({ entries, transcribe, onCaption }) {
  function forget(stream, version) {
    stream.previewTexts.delete(version);
    stream.previewChunks.delete(version);
  }

  function saveFinal(state, speaker, text) {
    if (text) entries.add(state.id, 'transcript', text, speaker);
    onCaption({ sessionId: state.id, speaker, text, final: true });
  }

  function fail(state, speaker, message) {
    state.error = new Error(message);
    onCaption({ sessionId: state.id, speaker, text: '', final: false, error: message });
  }

  function decoded(state, speaker, text, final, version) {
    const stream = state.sources[speaker];
    if (final) {
      const completion = validTranscript(text) ? text : stream.previewTexts.get(version) || '';
      forget(stream, version);
      saveFinal(state, speaker, completion);
      return;
    }
    if (!validTranscript(text)) return;
    const chunks = stream.previewChunks.get(version) || [];
    if (chunks.at(-1) !== text) chunks.push(text);
    stream.previewChunks.set(version, chunks);
    const preview = chunks.join(' ');
    stream.previewTexts.set(version, preview);
    if (stream.version === version) onCaption({ sessionId: state.id, speaker, text: preview, final: false });
  }

  function failed(state, speaker, final, version) {
    if (state.controller.signal.aborted || !final) return;
    const stream = state.sources[speaker],
      completion = stream.previewTexts.get(version) || '';
    forget(stream, version);
    if (completion) saveFinal(state, speaker, completion);
    else fail(state, speaker, 'Local live transcription failed. Check the Whisper server and restart listening.');
  }

  function enqueue(state, speaker, pcm, final, version) {
    const stream = state.sources[speaker];
    if (!final && stream.pending >= 2) return;
    if (final && stream.pending >= 4) {
      fail(state, speaker, 'Local transcription is falling behind. Stop listening and use a faster model.');
      return;
    }
    stream.pending++;
    stream.queue = stream.queue
      .then(async () => {
        state.controller.signal.throwIfAborted();
        const bytes = Uint8Array.from(wav(pcm, MAX_UTTERANCE_BYTES)).buffer;
        const options = { ...state.settings, liveDecode: final ? 'final' : 'preview' };
        const text = (
          await transcribe(
            { bytes, mime: 'audio/wav' },
            options,
            AbortSignal.any([state.controller.signal, AbortSignal.timeout(90000)]),
          )
        ).trim();
        state.controller.signal.throwIfAborted();
        decoded(state, speaker, text, final, version);
      })
      .catch(() => failed(state, speaker, final, version))
      .finally(() => {
        stream.pending--;
      });
  }

  function ended(state, speaker, utterance) {
    const stream = state.sources[speaker];
    if (!utterance.heard) return;
    const version = stream.version;
    if (utterance.audio) enqueue(state, speaker, utterance.audio, true, version);
    else {
      stream.queue = stream.queue.then(() => forget(stream, version));
      onCaption({ sessionId: state.id, speaker, text: '', final: true });
    }
    stream.version++;
  }

  return { enqueue, ended };
}
module.exports = { createUtteranceDecoder };
