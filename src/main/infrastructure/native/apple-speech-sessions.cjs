const { spawn } = require('node:child_process');
const { wavSamples } = require('../../domain/audio/wav.cjs');
const { spawnSpeechPart, writePcm, stopPart } = require('./speech-part.cjs');
const { requestedLanguages, preflightLanguages } = require('./live-languages.cjs');
const { createLanguagePicker } = require('../../domain/audio/language-picker.cjs');
const { relaunch } = require('./language-switch.cjs');

// Live Apple Speech captions: one helper per speaker and language of a session, final lines saved as transcript
// entries. The automatic language runs a second helper per speaker in the other language, because two recognizers in
// one process cancel each other, and a picker per speaker decides whose text is published. A language change
// restarts the running helpers.
class AppleSpeechSessions {
  constructor({ settings, sessions, entries }, executable, onCaption, options = {}) {
    this.repositories = { settings, sessions, entries };
    this.executable = executable;
    this.onCaption = onCaption;
    this.spawn = options.spawn || spawn;
    this.preflight = options.preflight;
    this.onReady = options.onReady;
    // Tells the user something went wrong without ending the captions; a caption error ends the recording.
    this.onNotice = options.onNotice;
    this.now = options.now || (() => 0);
    this.readyTimeout = options.readyTimeout || 180000;
    this.stopTimeout = options.stopTimeout || 11000;
    this.sessions = new Map();
    this.closed = false;
  }

  async start(owner, id) {
    if (this.closed) throw new Error('Apple Speech is closed.');
    if (this.sessions.has(owner) || [...this.sessions.values()].some((item) => item.id === id))
      throw new Error('Stop the previous Apple Speech session first.');
    this.repositories.sessions.get(id);
    const settings = this.repositories.settings.read();
    if (settings.transcriptionProvider !== 'apple' || !settings.liveTranscription)
      throw new Error('Select Apple Speech and enable live captions first.');
    const languages = requestedLanguages(settings.appleSpeechLocale);
    const state = { owner, id, ...languages, parts: new Map(), pickers: new Map(), stopping: false, suppress: false };
    this.sessions.set(owner, state);
    const startup = this.open(state, languages, settings.systemAudio);
    // A language change waits until the session has started in the language it asked for.
    state.queue = startup.catch(() => {});
    return startup;
  }

  async open(state, languages, systemAudio) {
    const { owner } = state;
    try {
      if (this.preflight) Object.assign(state, await this.checked(state, languages));
      if (state.stopping || this.sessions.get(owner) !== state) throw new Error('Apple Speech startup was cancelled.');
      await this.startSpeaker(state, 'ME');
      if (state.stopping || this.sessions.get(owner) !== state) throw new Error('Apple Speech startup was cancelled.');
      if (systemAudio) await this.startSpeaker(state, 'THEY');
      return true;
    } catch (error) {
      if (this.sessions.get(owner) === state) await this.stop(owner, true);
      throw error;
    }
  }

  checked(state, languages) {
    return preflightLanguages(languages, { preflight: this.preflight, cancelled: () => state.stopping });
  }

  // Applies the saved language to every running session right away (see language-switch.cjs).
  switchLanguage() {
    return Promise.all(
      [...this.sessions.values()].map((state) => (state.queue = state.queue.then(() => relaunch(this, state)))),
    );
  }

  // Starts a speaker's helper in the session's language, and a second one in the alternate with a fresh picker.
  async startSpeaker(state, speaker) {
    if (state.alternate)
      state.pickers.set(speaker, createLanguagePicker({ primary: state.locale, alternate: state.alternate }));
    else state.pickers.delete(speaker);
    await Promise.all([state.locale, state.alternate].filter(Boolean).map((locale) => this.startPart(state, speaker, locale)));
  }

  async startPart(state, speaker, locale) {
    const { part, started } = spawnSpeechPart({
      spawn: this.spawn,
      executable: this.executable,
      sessionId: state.id,
      locale,
      speaker,
      readyTimeout: this.readyTimeout,
      onMessage: (message) => this.message(state, part, message),
      onOverflow: () => {
        if (!part.retired) this.fail(state, 'Apple Speech sent too much data.');
      },
      onEnded: () => {
        if (state.stopping || state.suppress || part.retired) return;
        if (!this.dropAlternate(state, part)) this.fail(state, 'Apple Speech stopped unexpectedly.');
      },
    });
    state.parts.set(`${speaker} ${locale}`, part);
    await started;
  }

  // The alternate language's helper failed after it started: the speaker goes on in the primary alone and the user
  // is told, instead of the whole recording ending. Returns whether `part` was such a helper.
  dropAlternate(state, part) {
    const picker = state.pickers.get(part.speaker);
    if (!picker || !part.ready || part.locale !== state.alternate) return false;
    part.retired = true;
    state.parts.delete(`${part.speaker} ${part.locale}`);
    picker.drop(part.locale);
    void stopPart(part, this.stopTimeout);
    this.onNotice?.(`Apple Speech stopped recognizing ${part.locale}; captions go on in ${state.locale}.`);
    return true;
  }

  message(state, part, message) {
    if (state.suppress || part.retired || this.sessions.get(state.owner) !== state) return;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'ready') {
      if (!part.settled) {
        try {
          this.onReady?.(message.resolvedLocale || part.locale);
        } catch (error) {
          part.settled = true;
          part.rejectReady(error);
          return;
        }
        part.settled = true;
        part.ready = true;
        part.resolveReady(true);
      }
      return;
    }
    if (message.type === 'error') {
      const error = String(message.error || 'Apple Speech failed.').slice(0, 300);
      if (!part.settled) {
        part.settled = true;
        part.rejectReady(new Error(error));
      } else if (!state.stopping && !this.dropAlternate(state, part)) this.fail(state, error);
      return;
    }
    if (!part.ready || !['partial', 'final'].includes(message.type) || typeof message.text !== 'string') return;
    const event = { type: message.type, text: message.text.trim() };
    const picker = state.pickers.get(part.speaker);
    for (const item of picker ? picker.receive(part.locale, event, this.now()) : [event]) this.publish(state, part.speaker, item);
  }

  publish(state, speaker, { type, text }) {
    if (type === 'final' && text) this.repositories.entries.add(state.id, 'transcript', text, speaker);
    this.onCaption({ sessionId: state.id, speaker, text, final: type === 'final' });
  }

  fail(state, error) {
    this.onCaption({ sessionId: state.id, speaker: 'ME', text: '', final: false, error });
  }

  owns(owner) {
    return this.sessions.has(owner);
  }
  setPaused(owner, paused) {
    const state = this.sessions.get(owner);
    if (!state || state.stopping) throw new Error('Apple Speech session is no longer active.');
    state.paused = paused;
  }
  push(owner, input) {
    const state = this.sessions.get(owner);
    if (!state || state.stopping || input?.sessionId !== state.id)
      throw new Error('Apple Speech session is no longer active.');
    return this.write(state, input.speaker, input.samples);
  }

  write(state, speaker, samples) {
    if (
      !['ME', 'THEY'].includes(speaker) ||
      !(samples instanceof ArrayBuffer) ||
      samples.byteLength % 2 ||
      samples.byteLength > 512000
    )
      throw new Error('Invalid Apple Speech audio packet.');
    if (state.paused) return true;
    const parts = this.partsOf(state, speaker);
    // While the language changes, audio for a helper that is not listening yet is dropped.
    const listening = state.restarting ? parts.filter((part) => part.ready && !part.retired) : parts;
    if (!listening.length && !state.restarting) return writePcm(undefined, samples);
    for (const part of listening) writePcm(part, samples);
    return true;
  }

  partsOf(state, speaker) {
    return [...state.parts.values()].filter((part) => part.speaker === speaker);
  }

  pushSystem(segment) {
    const state = [...this.sessions.values()].find((item) => item.id === segment.sessionId && !item.stopping);
    if (!state || state.paused || !this.partsOf(state, 'THEY').length) return false;
    try {
      return this.write(state, 'THEY', wavSamples(segment.bytes));
    } catch (error) {
      this.fail(state, error.message);
      return false;
    }
  }

  async stop(owner, suppress = false) {
    const state = this.sessions.get(owner);
    if (!state) return false;
    state.stopping = true;
    state.suppress = suppress;
    await Promise.all([...state.parts.values()].map((part) => stopPart(part, this.stopTimeout)));
    // Finals a picker still holds, from a session too short for a decision, are saved before it closes.
    if (!suppress && this.sessions.get(owner) === state)
      for (const [speaker, picker] of state.pickers) for (const event of picker.finish()) this.publish(state, speaker, event);
    if (this.sessions.get(owner) === state) this.sessions.delete(owner);
    return true;
  }

  async stopSession(id, suppress = false) {
    await Promise.all(
      [...this.sessions.values()].filter((item) => item.id === id).map((item) => this.stop(item.owner, suppress)),
    );
  }
  // Graceful stop for quit: lets helpers deliver their final transcript before closing.
  drain() {
    return Promise.allSettled([...this.sessions.keys()].map((owner) => this.stop(owner, false)));
  }
  async close() {
    this.closed = true;
    await Promise.all([...this.sessions.keys()].map((owner) => this.stop(owner, true)));
  }
}
module.exports = { AppleSpeechSessions };
