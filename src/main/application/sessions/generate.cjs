const { text } = require('../../domain/shared/text.cjs');
const policy = require('../../domain/sessions/generation.cjs');
const { validateGenerationRequest } = require('../../domain/sessions/generation-admission.cjs');
const { checkHesitation } = require('./hesitation-check.cjs');
const { createGenerationRequest } = require('./generation-request.cjs');
const { createGenerationPrompt } = require('./generation-prompt.cjs');
const { createAnswerPublisher } = require('./generation-answer.cjs');
const { isSilentAnswer } = require('../../domain/sessions/notch-insight.cjs');

// One generated answer for a session, in any mode. Validation happens before the request is registered; the
// local lease is released as soon as streaming ends; chat stores the user's question before inference, and
// every mode except a summary rewrite persists its result, offers it to the Notch and publishes it.
function createGeneration({
  sessions,
  settings,
  active,
  notch,
  requests,
  acquireLocal,
  compactor,
  providers,
  prepareContext,
  summaryRewrite,
  requestImages,
  insightRounds = null,
  events,
  changed,
  log = (message) => console.error(message),
  // Routine traces, such as an automatic request starting, stay out of the error log (main.log keeps errors and
  // warnings only) so real failures remain easy to find.
  trace = (message) => console.info(message),
  // A request still waiting after this long is written to main.log as a warning with its provider and model, so a slow
  // or stalled model can be told apart from a failure.
  warn = (message) => console.warn(message),
  slowAfterMs = 30000,
  // The composition passes the real timers; without them no slow warning is scheduled.
  timers = null,
}) {
  const preparePrompt = createGenerationPrompt({ sessions, active, prepareContext, summaryRewrite, providers });
  const publishAnswer = createAnswerPublisher({ sessions, notch, summaryRewrite, events, changed });
  const runRequest = createGenerationRequest({
    requests,
    finished: (payload) => {
      if (policy.showsInOverlay(payload.mode)) events.finished(payload, payload.mode);
    },
  });
  // Admission order: the floating surfaces show the newest admitted generation and ignore older ones.
  let admitted = 0;
  async function execute({ id, mode, session: s, current, question, images, input, sender, sequence }, signal) {
    if (policy.showsInOverlay(mode) && mode !== 'compact')
      events.overlayDelta({ requestId: id, sessionId: s.id, mode, delta: '', sequence }, mode);
    const chosen = policy.generationSettings(mode, current, s, input);
    signal.throwIfAborted();
    const lease = chosen.provider === 'local' ? await acquireLocal(chosen, signal) : null;
    if (signal.aborted) {
      lease?.release();
      signal.throwIfAborted();
    }
    if (mode === 'summaryRewrite' && s.provider === 'local' && s.model && lease?.model !== s.model) {
      lease?.release();
      throw new Error('Start the local model recorded for this session to rewrite its overview.');
    }
    const route = policy.localRoute(chosen, lease);
    if (mode === 'insightHesitation') {
      try {
        return await checkHesitation({
          providers,
          active,
          sessionId: s.id,
          route,
          liveTranscript: input.liveTranscript,
          signal,
        });
      } finally {
        lease?.release();
      }
    }
    if (mode === 'compact') {
      try {
        return (await compactor.compact(s.id, route, signal)).summary;
      } finally {
        lease?.release();
        changed();
      }
    }
    let prompt;
    try {
      prompt = await preparePrompt({ id, mode, session: s, question, images, input, route, lease, signal });
    } catch (error) {
      lease?.release();
      throw error;
    }
    let answer;
    try {
      answer = await providers.stream(
        route,
        prompt.prepared,
        (delta) => {
          events.ownerDelta(sender, { requestId: id, delta });
          if (policy.showsInOverlay(mode))
            events.overlayDelta({ requestId: id, sessionId: s.id, mode, delta, sequence }, mode);
        },
        signal,
        images,
      );
    } finally {
      lease?.release();
      // A live insight's round counts as analyzed only when its answer is shown.
      if (mode === 'insight')
        insightRounds?.settle(s.id, !signal.aborted && Boolean(answer) && !isSilentAnswer(answer));
    }
    signal.throwIfAborted();
    return publishAnswer({ id, mode, session: s, answer, sequence });
  }
  return {
    // Automatic requests and every failure are logged: the window that asked may be hidden, so its error toast
    // is never seen. A cancelled request (replaced, stopped or its session ended) is traced, not logged as a failure.
    async run(input, { sender }) {
      let completion;
      try {
        const answer = await admit(input, sender, (value) => {
          completion = value;
        });
        return answer;
      } catch (error) {
        const cancelled = completion?.outcome === 'cancelled';
        if (cancelled) trace(`Generation ${input?.mode || 'chat'} was cancelled.`);
        else log(`Generation ${input?.mode || 'chat'} failed: ${error?.message || error}`);
        // An automatic request has no visible owner: the workspace that asked may be hidden behind the bar.
        if (['insight', 'screenInsight'].includes(input?.mode) && input?.trigger !== 'manual' && !cancelled)
          events.automaticFailed?.(error?.message || String(error));
        throw error;
      }
    },
  };
  async function admit(input, sender, onCompletion) {
    if (!input || typeof input !== 'object') throw new Error('Invalid request.');
    const id = text(input.requestId, 100),
      session = sessions.get(input.sessionId),
      current = settings();
    const mode = policy.generationMode(input);
    validateGenerationRequest(input, mode, session, active.id());
    if (requests.has(id)) throw new Error('Request ID already in use.');
    const images = requestImages(input),
      question = policy.generationQuestion(mode, input, current);
    if (policy.isAutomatic(mode)) trace(`Generation ${mode} requested for session ${session.id}.`);
    const sequence = ++admitted;
    const slow = timers?.setTimeout(
      () =>
        warn(
          `Generation ${mode} has waited ${Math.round(slowAfterMs / 1000)} s for ${current.provider || 'the provider'} · ${current.model || 'its model'}.`,
        ),
      slowAfterMs,
    );
    try {
      return await runRequest(
        {
          id,
          owner: sender.id,
          sessionId: session.id,
          mode,
          sequence,
          timeoutMs: mode === 'insightHesitation' ? 20000 : 180000,
        },
        (signal) => execute({ id, mode, session, current, question, images, input, sender, sequence }, signal),
        onCompletion,
      );
    } finally {
      timers?.clearTimeout(slow);
    }
  }
}
module.exports = { createGeneration };
