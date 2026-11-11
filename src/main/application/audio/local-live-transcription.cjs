const { utteranceState, feedUtterance, endUtterance } = require('../../domain/audio/utterance-segmenter.cjs');
const { createUtteranceDecoder } = require('./utterance-decoder.cjs');

function source() {
  return {
    ...utteranceState(),
    version: 0,
    queue: Promise.resolve(),
    pending: 0,
    previewTexts: new Map(),
    previewChunks: new Map(),
  };
}

/**
 * Live captions from the managed local Whisper server for each owner's session: each speaker's audio is split into
 * utterances, decoded for previews and a saved final line. Stopping finishes buffered utterances unless discarded.
 */
function createLocalLiveTranscription({ settings, sessions: library, entries, models, transcribe, onCaption }) {
  const sessions = new Map();

  function owned(owner, id) {
    const state = sessions.get(owner);
    if (!state || state.id !== id || state.controller.signal.aborted)
      throw new Error('Live transcription is no longer active.');
    return state;
  }

  const { enqueue, ended } = createUtteranceDecoder({ entries, transcribe, onCaption });

  async function stop(owner, discard = false) {
    const state = sessions.get(owner);
    if (!state) return true;
    if (state.stopping) return state.stopping;
    state.accepting = false;
    if (discard) state.controller.abort();
    else for (const speaker of ['ME', 'THEY']) ended(state, speaker, endUtterance(state.sources[speaker]));
    state.stopping = (async () => {
      try {
        await Promise.all(Object.values(state.sources).map((stream) => stream.queue));
        if (state.error && !discard) throw state.error;
        return true;
      } finally {
        state.controller.abort();
        state.lease.release();
        if (sessions.get(owner) === state) sessions.delete(owner);
      }
    })();
    return state.stopping;
  }

  return {
    sessions,
    owned,
    stop,
    start(owner, id) {
      library.get(id);
      if (sessions.has(owner)) throw new Error('Stop the previous live transcription first.');
      const current = settings.read();
      if (current.transcriptionProvider !== 'local' || !current.liveTranscription)
        throw new Error('Select Local Whisper and enable live captions in audio settings.');
      const lease = models.acquire('whisper');
      sessions.set(owner, {
        id,
        settings: {
          ...current,
          language: String(current.language || 'auto').trim() || 'auto',
          transcriptionPrompt: String(current.transcriptionPrompt || '').slice(0, 2000),
        },
        lease,
        controller: new AbortController(),
        sources: { ME: source(), THEY: source() },
        accepting: true,
        error: null,
      });
      return true;
    },
    updateLanguage(owner, id, language, prompt) {
      const state = owned(owner, id);
      if (!state.accepting) throw new Error('Live transcription is finishing.');
      const next = typeof language === 'string' ? language.trim() || 'auto' : 'auto';
      if (next.length > 2000 || (typeof prompt === 'string' && prompt.length > 2000))
        throw new Error('Language and vocabulary must be at most 2,000 characters.');
      state.settings = {
        ...state.settings,
        language: next,
        ...(typeof prompt === 'string' ? { transcriptionPrompt: prompt } : {}),
      };
      return { sessionId: id, language: next };
    },
    push(owner, input) {
      const state = owned(owner, input?.sessionId);
      if (!state.accepting) throw new Error('Live transcription is finishing.');
      if (
        !['ME', 'THEY'].includes(input.speaker) ||
        !(input.samples instanceof ArrayBuffer) ||
        input.samples.byteLength % 2 ||
        input.samples.byteLength > 64000 ||
        !input.samples.byteLength
      )
        throw new Error('Send mono 16 kHz PCM frames of at most two seconds.');
      const stream = state.sources[input.speaker];
      for (const action of feedUtterance(stream, input.samples)) {
        if (action.preview) enqueue(state, input.speaker, action.preview, false, stream.version);
        else ended(state, input.speaker, action.end);
      }
      return true;
    },
    // Graceful stop for quit: finishes buffered utterances so the last words are saved.
    drain: () => Promise.allSettled([...sessions.keys()].map((owner) => stop(owner, false))),
    close: () => Promise.all([...sessions.keys()].map((owner) => stop(owner, true))),
  };
}
module.exports = { createLocalLiveTranscription };
