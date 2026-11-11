const { HESITATION_PROMPT } = require('../../domain/sessions/realtime-policy.cjs');

// Asks the model whether the user is hesitating in what they are saying now. The answer is only HESITATING or
// FLUENT, and is dropped if the listening session changed while the model was deciding.
async function checkHesitation({ providers, active, sessionId, route, liveTranscript, signal }) {
  const messages = [
    { role: 'system', content: HESITATION_PROMPT },
    { role: 'user', content: liveTranscript },
  ];
  await providers.ready?.(route);
  signal.throwIfAborted();
  await providers.checkContext(route, messages, signal);
  const answer = await providers.stream(route, messages, () => {}, signal);
  signal.throwIfAborted();
  if (active.id() !== sessionId) throw new Error('The listening session changed during speech evaluation.');
  return /^HESITATING\b/i.test(String(answer).trim()) ? 'HESITATING' : 'FLUENT';
}
module.exports = { checkHesitation };
