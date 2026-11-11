// The Notch tracks one pending answer (offered, not yet seen) and the last answer the user actually saw.
// A display only counts when the expanded, visible, unconcealed Notch acknowledges the pending id.

function prunePending(pending, { activeId, concealed }) {
  return pending && (pending.sessionId !== activeId || (concealed && pending.automatic)) ? null : pending;
}
// Collapsing drops an automatic insight nobody saw; a requested answer stays pending.
function collapsePending(pending) {
  return pending?.automatic ? null : pending;
}

function offerAnswer({ requestId, sessionId, answer, automatic, activeId, notchOpen }) {
  const displayAckId = answer.trim() && sessionId === activeId && notchOpen ? requestId : null;
  return {
    displayAckId,
    expand: Boolean(displayAckId && automatic),
    replacesPending: sessionId === activeId,
    pending: displayAckId ? { id: requestId, sessionId, automatic } : null,
  };
}

function acknowledgement(pending, { id, activeId, expanded, visible, concealed, at }) {
  if (!pending || pending.id !== id || pending.sessionId !== activeId || !expanded || !visible || concealed)
    return null;
  return { id, sessionId: activeId, at };
}

function displayStatus({ pending, last, activeId }) {
  return {
    pendingAutomatic: Boolean(pending?.sessionId === activeId && pending.automatic),
    lastDisplayedAt: last?.sessionId === activeId ? last.at : null,
  };
}

module.exports = { prunePending, collapsePending, offerAnswer, acknowledgement, displayStatus };
