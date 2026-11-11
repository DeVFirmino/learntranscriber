const {
  realtimeModel,
  sessionUpdate,
  validTranscript,
  turnState,
  endTurn,
  turnSteps,
} = require('../../domain/audio/openai-realtime.cjs');

const URL_TRANSCRIPTION = 'wss://api.openai.com/v1/realtime?intent=transcription';

// Streaming meeting transcription over the OpenAI Realtime API, one socket per speaker and window.
// It runs only when the user picked OpenAI with live captions; audio leaves the Mac only then. Turns are
// committed on pauses, captions stream from delta events, and each completed turn is saved once.
class RealtimeTranscription {
  constructor(
    { settings, sessions, entries },
    key,
    onCaption,
    { WebSocketImpl = globalThis.WebSocket, url = URL_TRANSCRIPTION, finishTimeoutMs = 15000 } = {},
  ) {
    this.repositories = { settings, sessions, entries };
    this.key = key;
    this.onCaption = onCaption;
    this.WebSocket = WebSocketImpl;
    this.url = url;
    this.finishTimeoutMs = finishTimeoutMs;
    this.sessions = new Map();
  }
  owns(owner) {
    return this.sessions.has(owner);
  }
  async start(owner, id) {
    this.repositories.sessions.get(id);
    if (this.sessions.has(owner)) throw new Error('Stop the previous live transcription first.');
    const settings = this.repositories.settings.read();
    if (settings.transcriptionProvider !== 'openai' || !settings.liveTranscription)
      throw new Error('Select OpenAI and enable live captions in audio settings.');
    const model = realtimeModel(settings.transcriptionModel);
    const state = {
      id,
      owner,
      model,
      language: String(settings.language || '').trim(),
      prompt: String(settings.transcriptionPrompt || '').slice(0, 2000),
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
      throw new Error('Add an OpenAI API key in AI sources before using live OpenAI captions.');
    }
    if (this.sessions.get(owner) !== state) throw new Error('Live transcription was stopped.');
    return true;
  }
  owned(owner, id) {
    const state = this.sessions.get(owner);
    if (!state || state.id !== id) throw new Error('Live transcription is no longer active.');
    return state;
  }
  updateLanguage(owner, id, language, prompt) {
    const state = this.owned(owner, id);
    if (typeof language === 'string' && language.length <= 2000)
      state.language = language.trim() === 'auto' ? '' : language.trim();
    if (typeof prompt === 'string' && prompt.length <= 2000) state.prompt = prompt;
    return { sessionId: id, language: state.language || 'auto' };
  }
  speaker(state, speaker) {
    let stream = state.speakers.get(speaker);
    if (stream) return stream;
    const socket = new this.WebSocket(this.url, { headers: { Authorization: 'Bearer ' + state.key } });
    stream = { socket, ready: null, turn: turnState(), pending: 0, partials: new Map(), settle: null };
    // The session is configured before any audio is sent on the socket.
    const configure = sessionUpdate(state);
    stream.ready = new Promise((resolve, reject) => {
      socket.onopen = () => {
        socket.send(JSON.stringify(configure));
        resolve();
      };
      socket.onerror = () => reject(new Error('Could not connect to OpenAI live transcription.'));
    });
    stream.ready.catch((error) => this.fail(state, speaker, error));
    socket.onmessage = (message) => this.receive(state, speaker, stream, message.data);
    socket.onclose = () => {
      if (state.accepting && !state.error)
        this.fail(state, speaker, new Error('OpenAI live transcription disconnected.'));
      stream.settle?.();
    };
    state.speakers.set(speaker, stream);
    return stream;
  }
  send(stream, event) {
    stream.ready
      .then(() => {
        if (stream.socket.readyState === 1) stream.socket.send(JSON.stringify(event));
      })
      .catch(() => {});
  }
  receive(state, speaker, stream, data) {
    let event;
    try {
      event = JSON.parse(String(data));
    } catch {
      return;
    }
    if (event.type === 'conversation.item.input_audio_transcription.delta' && typeof event.delta === 'string') {
      const text = (stream.partials.get(event.item_id) || '') + event.delta;
      stream.partials.set(event.item_id, text);
      if (state.accepting) this.onCaption({ sessionId: state.id, speaker, text, final: false });
    } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
      stream.partials.delete(event.item_id);
      stream.pending = Math.max(0, stream.pending - 1);
      const text = typeof event.transcript === 'string' ? event.transcript.trim() : '';
      if (validTranscript(text)) this.repositories.entries.add(state.id, 'transcript', text, speaker);
      this.onCaption({ sessionId: state.id, speaker, text: validTranscript(text) ? text : '', final: true });
      if (!stream.pending) stream.settle?.();
    } else if (event.type === 'error' || event.type === 'conversation.item.input_audio_transcription.failed') {
      stream.pending = Math.max(0, stream.pending - (event.type === 'error' ? 0 : 1));
      this.fail(
        state,
        speaker,
        new Error('OpenAI live transcription failed. Check the key, model access and billing.'),
      );
      if (!stream.pending) stream.settle?.();
    }
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
    if (
      !['ME', 'THEY'].includes(input.speaker) ||
      !(input.samples instanceof ArrayBuffer) ||
      input.samples.byteLength % 2 ||
      input.samples.byteLength > 64000 ||
      !input.samples.byteLength
    )
      throw new Error('Send mono 16 kHz PCM frames of at most two seconds.');
    const stream = this.speaker(state, input.speaker);
    for (const step of turnSteps(stream.turn, new Int16Array(input.samples)))
      if (step.commit) this.commit(stream);
      else
        this.send(stream, {
          type: 'input_audio_buffer.append',
          audio: Buffer.from(step.audio.buffer).toString('base64'),
        });
    return true;
  }
  // The turn has ended; its transcript arrives later.
  commit(stream) {
    this.send(stream, { type: 'input_audio_buffer.commit' });
    stream.pending++;
  }
  // Graceful stop commits what was heard and waits (bounded) for those turns; discard closes at once.
  async stop(owner, discard = false) {
    const state = this.sessions.get(owner);
    if (!state) return true;
    if (state.stopping) return state.stopping;
    state.accepting = false;
    state.stopping = (async () => {
      try {
        if (!discard)
          await Promise.all(
            [...state.speakers.values()].map((stream) => {
              if (endTurn(stream.turn)) this.commit(stream);
              if (!stream.pending) return undefined;
              return new Promise((resolve) => {
                stream.settle = resolve;
                const timer = setTimeout(resolve, this.finishTimeoutMs);
                timer.unref?.();
              });
            }),
          );
        if (state.error && !discard) throw state.error;
        return true;
      } finally {
        for (const stream of state.speakers.values())
          try {
            stream.socket.close();
          } catch {}
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
module.exports = { RealtimeTranscription };
