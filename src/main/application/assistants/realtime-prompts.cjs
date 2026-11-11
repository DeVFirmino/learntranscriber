const { forFeature } = require('../../domain/providers/generation-presets.cjs');
const { resolvePrompt } = require('../../domain/assistants/prompt-fallbacks.cjs');
const { generationSettings } = require('../../domain/sessions/generation.cjs');
const {
  META_SYSTEM,
  metaUserMessage,
  fallbackInstruction,
  languageInstruction,
} = require('../../domain/assistants/realtime-prompt.cjs');

// The live-response instruction for automatic insights. An assistant's own realtime prompt wins. Otherwise one meta
// request on the realtimeSummaryMeta preset generates the instruction from the system prompt, and the result is kept
// for that assistant, prompt, language and model. A local model skips the meta request. A failed request uses the
// language fallback for ten minutes before trying again, and a cancelled one keeps nothing. The
// request is made when a session starts; an insight that arrives while it runs waits for it instead of asking again.
const FALLBACK_TTL_MS = 10 * 60 * 1000;
function createRealtimePrompts({ providers, now }) {
  const cache = new Map(),
    pending = new Map();
  // The cached or immediate answer, or the key and inputs of the meta request still to make.
  function plan(assistant, settings) {
    const own = resolvePrompt('realtime', assistant, { settings });
    if (own.source === 'assistant') return { result: own };
    const language = languageInstruction(settings);
    if (settings.managedLocal || settings.provider === 'local')
      return { result: { prompt: fallbackInstruction(language), source: 'local default' } };
    const system = resolvePrompt('system', assistant, { settings }).prompt;
    const key = JSON.stringify([assistant?.id || '', system, language, settings.provider, settings.model]);
    const cached = cache.get(key);
    if (cached && (!cached.until || cached.until > now())) return { result: cached.result };
    return { key, system, language };
  }
  async function generate({ key, system, language }, settings, signal) {
    let result;
    try {
      const generated = await providers.stream(
        forFeature(settings, 'realtimeSummaryMeta'),
        [
          { role: 'system', content: META_SYSTEM },
          { role: 'user', content: metaUserMessage(system, language) },
        ],
        () => {},
        signal,
      );
      signal?.throwIfAborted();
      const text = String(generated || '').trim();
      result = text
        ? { prompt: text, source: 'generated' }
        : { prompt: fallbackInstruction(language), source: 'fallback' };
    } catch (error) {
      if (signal?.aborted) throw error;
      result = { prompt: fallbackInstruction(language), source: 'fallback' };
    }
    cache.set(key, { result, until: result.source === 'fallback' ? now() + FALLBACK_TTL_MS : 0 });
    return result;
  }
  // Waits for the session-start request, giving up as soon as the insight itself is cancelled.
  function join(running, signal) {
    if (!signal) return running;
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      running.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }
  return {
    async guidance({ assistant, settings, signal }) {
      const next = plan(assistant, settings);
      if (next.result) return next.result;
      const running = pending.get(next.key);
      return running ? join(running, signal) : generate(next, settings, signal);
    },
    // The session-start request. It never fails: a failure leaves the fallback, as for an insight.
    prepare({ assistant, settings }) {
      const next = plan(assistant, settings);
      if (next.result || pending.has(next.key)) return Promise.resolve();
      const running = generate(next, settings).finally(() => pending.delete(next.key));
      pending.set(next.key, running);
      return running.then(
        () => {},
        () => {},
      );
    },
    clear: () => cache.clear(),
  };
}

// Prepares the live-response instruction when a session starts with automatic insights on, using the same
// insight settings the first insight will use.
function prepareOnSessionStart({ settings, sessions, assistants, realtimePrompts }) {
  return (id) => {
    const current = settings.read(),
      session = sessions.get(id);
    if (current.autoInsights === false) return Promise.resolve();
    return realtimePrompts.prepare({
      assistant: assistants.forSession(session.assistant_id),
      settings: generationSettings('insight', current, session),
    });
  };
}

module.exports = { createRealtimePrompts, prepareOnSessionStart };
