const { needsTranscript, validateReviewedContext } = require('./generation.cjs');
const { TRIGGERS } = require('./notch-insight.cjs');

// What a generation request must satisfy before it is registered: reviewed text and live speech within limits,
// live speech only for live insights, the listening session for a
// hesitation check, and a transcript for the modes that read one. `activeSessionId` is the listening session.
function validateGenerationRequest(input, mode, session, activeSessionId) {
  validateReviewedContext(input.context);
  validateReviewedContext(input.liveTranscript);
  if (input.liveTranscript !== undefined && !['insight', 'insightHesitation'].includes(mode))
    throw new Error('Provisional speech is only used for live insights.');
  if (input.trigger !== undefined && (mode !== 'insight' || !TRIGGERS.has(input.trigger)))
    throw new Error('Invalid live insight trigger.');
  if (mode === 'insightHesitation' && (activeSessionId !== session.id || !input.liveTranscript?.trim()))
    throw new Error('Speech evaluation requires the active listening session and live speech.');
  const summaryConversation =
    mode === 'summary' &&
    session.entries.some((entry) => ['user', 'assistant', 'transcript'].includes(entry.kind) && entry.content?.trim());
  if (
    needsTranscript(mode) &&
    !summaryConversation &&
    !session.entries.some((e) => e.kind === 'transcript') &&
    !input.liveTranscript?.trim()
  )
    throw new Error('Add or record a transcript before generating session insights.');
}

module.exports = { validateGenerationRequest };
