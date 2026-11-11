const CONFLICT = 'Overview changed in another window. Reload it or explicitly replace it.';

/**
 * Persists a finished generation for its mode. A generated summary uses the overview's
 * optimistic check against the summary captured when generation started, so a manual
 * save made meanwhile is never overwritten.
 */
function persistGeneratedOutput({ sessions, entries }, session, mode, answer, requestId) {
  if (mode === 'summary') {
    try {
      sessions.updateSummary(session.id, answer, session.summary);
    } catch (error) {
      if (error.message === CONFLICT)
        throw new Error(
          'The overview changed while the summary was generating. Your saved overview was kept; generate again to replace it.',
        );
      throw error;
    }
    return null;
  }
  if (mode === 'translation') {
    sessions.update(session.id, { translation: answer });
    return null;
  }
  return entries.add(session.id, 'assistant', answer, '', null, { mode, requestId });
}

module.exports = { persistGeneratedOutput };
