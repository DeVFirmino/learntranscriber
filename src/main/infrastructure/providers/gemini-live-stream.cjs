const { merge, validTranscript, liveSetup, fatalClose, MAX_RECONNECTS } = require('../../domain/audio/gemini-live.cjs');

async function messageText(data) {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  if (data && typeof data.text === 'function') return data.text();
  return String(data);
}

// One speaker's Live session over the BidiGenerateContent socket: the running transcription it merges and shows, the
// pause fallback that saves words when the server never completes the turn, a fresh session every 30 s, and up to
// three reconnects. `state` is the owner's live transcription, shared by both speakers.
class GeminiLiveStream {
  constructor(state, speaker, options) {
    this.state = state;
    this.speaker = speaker;
    this.options = options;
    this.socket = null;
    this.generation = 0;
    this.ready = null;
    this.buffer = '';
    this.lastDelta = 0;
    this.pauseTimer = null;
    this.reconnectTimer = null;
    this.attempts = 0;
    this.validated = false;
    this.reconnecting = false;
    this.closing = false;
    this.connect();
    this.recycleTimer = options.timers.setInterval(() => {
      if (state.accepting && !this.reconnecting) this.recycle();
    }, options.recycleMs);
    this.recycleTimer.unref?.();
  }
  connect() {
    const generation = ++this.generation;
    const socket = new this.options.WebSocket(this.options.url + '?key=' + encodeURIComponent(this.state.key));
    this.socket = socket;
    this.ready = new Promise((resolve, reject) => {
      socket.onopen = () => socket.send(JSON.stringify(liveSetup(this.state.model)));
      socket.onmessage = (message) =>
        void messageText(message.data).then((text) => {
          if (generation !== this.generation) return;
          let event;
          try {
            event = JSON.parse(text);
          } catch {
            return;
          }
          if (event.setupComplete) resolve();
          this.receive(event);
        });
      socket.onerror = () => reject(new Error('Could not connect to Gemini live transcription.'));
      socket.onclose = (event) => {
        reject(new Error('Gemini live transcription disconnected.'));
        if (generation === this.generation) this.disconnected(String(event?.reason || ''));
      };
    });
    this.ready.catch(() => {});
  }
  receive(event) {
    const content = event?.serverContent;
    if (!content) return;
    if (!this.validated) {
      this.validated = true;
      this.attempts = 0;
    }
    // Output transcription would be the model talking; transcription-only mode ignores it.
    const text = content.inputTranscription?.text;
    if (typeof text === 'string' && text.trim()) {
      this.buffer = merge(this.buffer, text).full;
      this.lastDelta = Date.now();
      if (this.state.accepting)
        this.options.onCaption({ sessionId: this.state.id, speaker: this.speaker, text: this.buffer, final: false });
      this.watchPause();
    }
    if (content.turnComplete) this.flush();
  }
  // If the server never completes the turn, the buffered words are saved after twice the pause.
  watchPause() {
    const { timers, fallbackPauseMs } = this.options;
    if (this.pauseTimer) timers.clearTimeout(this.pauseTimer);
    this.pauseTimer = timers.setTimeout(() => {
      this.pauseTimer = null;
      if (Date.now() - this.lastDelta >= fallbackPauseMs) this.flush();
    }, fallbackPauseMs);
    this.pauseTimer.unref?.();
  }
  flush() {
    if (this.pauseTimer) {
      this.options.timers.clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    const text = this.buffer.trim();
    this.buffer = '';
    if (!text) return;
    const saved = validTranscript(text);
    if (saved) this.options.entries.add(this.state.id, 'transcript', text, this.speaker);
    this.options.onCaption({ sessionId: this.state.id, speaker: this.speaker, text: saved ? text : '', final: true });
  }
  send(event) {
    this.ready
      .then(() => {
        if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(event));
      })
      .catch(() => {});
  }
  // Every 30 s this saves what it heard and opens a fresh Live session, so context never piles up.
  recycle() {
    this.flush();
    const previous = this.socket;
    this.validated = false;
    this.connect();
    try {
      previous?.close();
    } catch {}
  }
  disconnected(reason) {
    // The buffered words stay and keep merging after a reconnect.
    if (!this.state.accepting || this.closing) return;
    if (fatalClose(reason))
      return this.options.fail(new Error(`Invalid Gemini Live configuration (${this.state.model}): ${reason}`));
    if (this.reconnecting) return;
    this.validated = false;
    if (this.attempts >= MAX_RECONNECTS)
      return this.options.fail(
        new Error(`Gemini live transcription stopped after ${MAX_RECONNECTS} reconnection attempts.`),
      );
    this.reconnecting = true;
    this.attempts++;
    const delay = this.options.reconnectDelayMs * 2 ** (this.attempts - 1);
    this.reconnectTimer = this.options.timers.setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnecting = false;
      if (this.state.accepting && !this.closing) this.connect();
    }, delay);
    this.reconnectTimer.unref?.();
  }
  // Stops the timers and the socket for good.
  dispose() {
    const { timers } = this.options;
    for (const [clear, timer] of [
      [timers.clearTimeout, this.pauseTimer],
      [timers.clearTimeout, this.reconnectTimer],
      [timers.clearInterval, this.recycleTimer],
    ])
      if (timer) clear(timer);
    try {
      this.socket?.close();
    } catch {}
  }
}

module.exports = { GeminiLiveStream };
