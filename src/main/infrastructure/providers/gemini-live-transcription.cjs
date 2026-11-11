// Gemini Live transcription: one Live
// session per speaker over the BidiGenerateContent socket, input transcription only, server activity detection,
// a fresh session every 30 s, and up to three reconnects. Audio leaves the Mac only while the user chose Gemini
// with live captions.
const { PAUSE_MS, liveModel, validFrame } = require('../../domain/audio/gemini-live.cjs');
const { GeminiLiveStream } = require('./gemini-live-stream.cjs');

const BASE_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const FALLBACK_PAUSE_MS = Math.max(2 * PAUSE_MS, 2200);
const RECYCLE_MS = 30000; // gemini_context_clear_interval_ms
const RECONNECT_DELAY_MS = 1000;

class GeminiLiveTranscription {
  constructor(
    { settings, sessions, entries },
    key,
    onCaption,
    {
      WebSocketImpl = globalThis.WebSocket,
      url = BASE_URL,
      recycleMs = RECYCLE_MS,
      reconnectDelayMs = RECONNECT_DELAY_MS,
      fallbackPauseMs = FALLBACK_PAUSE_MS,
      timers = { setTimeout, clearTimeout, setInterval, clearInterval },
    } = {},
  ) {
    this.repositories = { settings, sessions, entries };
    this.key = key;
    this.onCaption = onCaption;
    this.streamOptions = {
      WebSocket: WebSocketImpl,
      url,
      recycleMs,
      reconnectDelayMs,
      fallbackPauseMs,
      timers,
      onCaption,
      entries,
    };
    this.sessions = new Map();
  }
  owns(owner) {
    return this.sessions.has(owner);
  }
  async start(owner, id) {
    this.repositories.sessions.get(id);
    if (this.sessions.has(owner)) throw new Error('Stop the previous live transcription first.');
    const settings = this.repositories.settings.read();
    if (settings.transcriptionProvider !== 'gemini' || !settings.liveTranscription)
      throw new Error('Select Gemini and enable live captions in audio settings.');
    const state = {
      id,
      owner,
      model: liveModel(settings.transcriptionModel),
      language: String(settings.language || '').trim(),
      speakers: new Map(),
      accepting: true,
      error: null,
      key: null,
    };
    this.sessions.set(owner, state);
    try {
      state.key = await this.key();
    } catch (error) {
      this.sessions.delete(owner);
      throw error;
    }
    if (!state.key) {
      this.sessions.delete(owner);
      throw new Error('Add a Gemini API key in AI sources before using live Gemini captions.');
    }
    if (this.sessions.get(owner) !== state) throw new Error('Live transcription was stopped.');
    return true;
  }
  owned(owner, id) {
    const state = this.sessions.get(owner);
    if (!state || state.id !== id) throw new Error('Live transcription is no longer active.');
    return state;
  }
  // Only records the language for its transcript filter; the Live session itself is unchanged.
  updateLanguage(owner, id, language) {
    const state = this.owned(owner, id);
    if (typeof language === 'string' && language.length <= 2000)
      state.language = language.trim() === 'auto' ? '' : language.trim();
    return { sessionId: id, language: state.language || 'auto' };
  }
  speaker(state, speaker) {
    let stream = state.speakers.get(speaker);
    if (stream) return stream;
    stream = new GeminiLiveStream(state, speaker, {
      ...this.streamOptions,
      fail: (error) => this.fail(state, speaker, error),
    });
    state.speakers.set(speaker, stream);
    return stream;
  }
  fail(state, speaker, error) {
    if (state.error) return;
    state.error = error;
    this.onCaption({ sessionId: state.id, speaker, text: '', final: false, error: error.message });
  }
  push(owner, input) {
    const state = this.owned(owner, input?.sessionId);
    if (!state.accepting) throw new Error('Live transcription is finishing.');
    if (state.error) throw state.error;
    if (!validFrame(input)) throw new Error('Send mono 16 kHz PCM frames of at most two seconds.');
    this.speaker(state, input.speaker).send({
      realtimeInput: {
        audio: { data: Buffer.from(input.samples).toString('base64'), mimeType: 'audio/pcm;rate=16000' },
      },
    });
    return true;
  }
  // A graceful stop saves the words already heard with a forced commit; discard drops them.
  async stop(owner, discard = false) {
    const state = this.sessions.get(owner);
    if (!state) return true;
    if (state.stopping) return state.stopping;
    state.accepting = false;
    state.stopping = (async () => {
      try {
        for (const stream of state.speakers.values()) {
          stream.closing = true;
          if (!discard) stream.flush();
        }
        if (state.error && !discard) throw state.error;
        return true;
      } finally {
        for (const stream of state.speakers.values()) stream.dispose();
        if (this.sessions.get(owner) === state) this.sessions.delete(owner);
      }
    })();
    return state.stopping;
  }
  drain() {
    return Promise.allSettled([...this.sessions.keys()].map((owner) => this.stop(owner, false)));
  }
  close() {
    return Promise.all([...this.sessions.keys()].map((owner) => this.stop(owner, true)));
  }
}

module.exports = { GeminiLiveTranscription };
