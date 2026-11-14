const { spawn } = require('node:child_process');
const { wavSamples } = require('../../domain/audio/wav.cjs');
const { spawnSpeechPart, writePcm, stopPart } = require('./speech-part.cjs');
const { requestedLanguages, preflightLanguages } = require('./live-languages.cjs');

// Live Apple Speech captions: one helper per speaker of a session, final lines saved as transcript entries. The
// automatic language gives each helper a second recognizer, and a language change restarts the running helpers.
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
    const state = { owner, id, ...languages, parts: new Map(), stopping: false, suppress: false };
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
      await this.startPart(state, 'ME');
      if (state.stopping || this.sessions.get(owner) !== state) throw new Error('Apple Speech startup was cancelled.');
      if (systemAudio) await this.startPart(state, 'THEY');
      return true;
    } catch (error) {
      if (this.sessions.get(owner) === state) await this.stop(owner, true);
      throw error;
    }
  }

  checked(state, languages) {
    return preflightLanguages(languages, { preflight: this.preflight, cancelled: () => state.stopping });
  }

  // Applies the saved language to every running session right away. Changes queue behind a session's startup and
  // earlier changes, and never reject: a language that cannot stream is a notice and the running helpers go on in the
  // old one; a new helper that fails after the old ones stopped is the session's caption error.
  switchLanguage() {
    return Promise.all(
      [...this.sessions.values()].map((state) => (state.queue = state.queue.then(() => this.relaunch(state)))),
    );
  }

  // The session's helpers stop without saving and new ones start for the same speakers, so the session goes on.
  async relaunch(state) {
    const setting = this.repositories.settings.read().appleSpeechLocale;
    if (state.stopping || state.setting === setting) return;
    const languages = await this.switchable(state, setting);
    if (!languages || state.stopping) return;
    const unchanged = languages.locale === state.locale && languages.alternate === state.alternate;
    Object.assign(state, languages);
    if (unchanged) return;
    const previous = [...state.parts];
    state.restarting = true;
    for (const [, part] of previous) part.retired = true;
    try {
      await Promise.all([
        ...previous.map(([, part]) => stopPart(part, this.stopTimeout)),
        ...previous.map(([speaker]) => this.startPart(state, speaker)),
      ]);
    } catch (error) {
      if (!state.stopping) this.fail(state, error.message);
    } finally {
      state.restarting = false;
    }
  }

  // The languages of a new setting, or null when the helper rejects them.
  async switchable(state, setting) {
    const requested = requestedLanguages(setting);
    if (!this.preflight) return requested;
    try {
      return await this.checked(state, requested);
    } catch (error) {
      if (!state.stopping) this.onNotice?.(error.message);
      return null;
    }
  }

  async startPart(state, speaker) {
    const { part, started } = spawnSpeechPart({
      spawn: this.spawn,
      executable: this.executable,
      sessionId: state.id,
      locale: state.locale,
      alternate: state.alternate,
      speaker,
      readyTimeout: this.readyTimeout,
      onMessage: (message) => this.message(state, part, message),
      onOverflow: () => {
        if (!part.retired) this.fail(state, 'Apple Speech sent too much data.');
      },
      onEnded: () => {
        if (!state.stopping && !state.suppress && !part.retired) this.fail(state, 'Apple Speech stopped unexpectedly.');
      },
    });
    state.parts.set(speaker, part);
    await started;
  }

  message(state, part, message) {
    if (state.suppress || part.retired || this.sessions.get(state.owner) !== state) return;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'ready') {
      if (!part.settled) {
        try {
          this.onReady?.(message.resolvedLocale || state.locale);
          if (state.alternate) this.onReady?.(state.alternate);
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
      } else if (!state.stopping) this.fail(state, error);
      return;
    }
    if (!part.ready || !['partial', 'final'].includes(message.type) || typeof message.text !== 'string') return;
    const text = message.text.trim();
    if (message.type === 'final') {
      if (text) this.repositories.entries.add(state.id, 'transcript', text, part.speaker);
      this.onCaption({ sessionId: state.id, speaker: part.speaker, text, final: true });
    } else this.onCaption({ sessionId: state.id, speaker: part.speaker, text, final: false });
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
    const part = state.parts.get(speaker);
    // While the language changes, audio for a helper that is not listening yet is dropped.
    if (state.restarting && (!part?.ready || part.retired)) return true;
    return writePcm(part, samples);
  }

  pushSystem(segment) {
    const state = [...this.sessions.values()].find((item) => item.id === segment.sessionId && !item.stopping);
    if (!state || state.paused || !state.parts.has('THEY')) return false;
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
