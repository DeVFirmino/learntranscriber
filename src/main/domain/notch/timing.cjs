function canStartAutomaticInsight({
  enabled,
  sessionId,
  activeSessionId,
  pending,
  lastDisplayed,
  minimumSeconds,
  now,
}) {
  if (!enabled || sessionId !== activeSessionId) return true;
  if (pending?.sessionId === sessionId && pending.automatic) return false;
  return lastDisplayed?.sessionId !== sessionId || now - lastDisplayed.at >= minimumSeconds * 1000;
}

module.exports = { canStartAutomaticInsight };
