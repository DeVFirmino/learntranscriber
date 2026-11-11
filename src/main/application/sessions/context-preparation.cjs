const { MIN_NEW_MESSAGES, newMessagesSince } = require('../../domain/sessions/compaction.cjs');
const { CONTEXTUAL, contextMessages } = require('../../domain/sessions/context-messages.cjs');
const { resolvePrompt } = require('../../domain/assistants/prompt-fallbacks.cjs');
const { createInsightRounds, insightMessages } = require('./insight-request.cjs');

// Reads one session's records and builds its model messages.
function messagesFor(
  { sessions, assistants, compactions, transcriptMemory },
  id,
  mode,
  question,
  reviewedContext = '',
  options = {},
) {
  const session = sessions.get(id);
  return contextMessages({
    ...options,
    session,
    assistant: assistants.forSession(session.assistant_id),
    memory: compactions.snapshot(id),
    transcript: CONTEXTUAL.includes(mode) || options.useMemory ? transcriptMemory.snapshot(id) : null,
    mode,
    question,
    reviewedContext,
  });
}

async function prepareSessionContext({
  repositories,
  compactor,
  providers,
  id,
  mode,
  question,
  settings,
  signal,
  reviewedContext,
  liveTranscript,
  image,
  realtimePrompts = null,
  insightRounds = null,
  trigger = 'manual',
}) {
  // A live insight is a two-message request: an instruction and the transcript round.
  // Without a realtime prompt service it uses the assistant's own realtime prompt or the default fallback instruction.
  if (mode === 'insight') {
    const session = repositories.sessions.get(id),
      assistant = repositories.assistants.forSession(session.assistant_id);
    const own = resolvePrompt('realtime', assistant, { settings });
    const guidance = realtimePrompts
      ? await realtimePrompts.guidance({ assistant, settings, signal })
      : own.source === 'assistant'
        ? own
        : { prompt: '', source: 'fallback' };
    const rounds = insightRounds || createInsightRounds();
    return insightMessages({ session, assistant, settings, guidance, liveTranscript, trigger, rounds });
  }
  // A summary reads the whole transcript while it fits; past the window it switches to session memory
  // and compacts.
  let useMemory = false;
  for (let compactions = 0; ;) {
    signal.throwIfAborted();
    const messages = messagesFor(repositories, id, mode, question, reviewedContext, {
      useMemory,
      liveTranscript,
      insightMode: settings.insightMode,
    });
    let overflow;
    try {
      await providers.checkContext(settings, messages, signal, image);
    } catch (error) {
      if (error.code !== 'CONTEXT_WINDOW_EXCEEDED') throw error;
      overflow = error;
    }
    signal.throwIfAborted();
    // Past the threshold, chat compacts automatically; after a checkpoint it waits for six new conversation messages.
    // Overflowing the model's actual capacity compacts regardless.
    const snapshot = repositories.compactions.snapshot(id);
    const threshold =
      mode === 'chat' &&
      repositories.sessions.get(id).compaction.estimatedTokens >= settings.compactThreshold &&
      newMessagesSince(snapshot.current, snapshot.entries) >= MIN_NEW_MESSAGES;
    if (overflow && mode === 'summary' && settings.autoCompact && !useMemory) {
      useMemory = true;
      continue;
    }
    const canCompact = settings.autoCompact && (CONTEXTUAL.includes(mode) || useMemory) && snapshot.entries.length > 8;
    if (!overflow && !(threshold && canCompact)) return messages;
    if (!canCompact) throw overflow;
    if (compactions >= 4)
      throw (
        overflow ||
        new Error(
          'Older history was compacted in four bounded passes. Compact again before asking; original entries are preserved.',
        )
      );
    await compactor.compact(id, settings, signal);
    compactions++;
  }
}
module.exports = { prepareSessionContext, messagesFor };
