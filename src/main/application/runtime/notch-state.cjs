const rules = require('../../domain/notch/transitions.cjs');
const { canStartAutomaticInsight } = require('../../domain/notch/timing.cjs');

// The one holder of Notch display state: expanded flag, pending answer and last acknowledged display.
function createNotchState({ now }) {
  let pending = null,
    last = null,
    expanded = false;
  return {
    expanded: () => expanded,
    setExpanded(value) {
      if (!value) pending = rules.collapsePending(pending);
      expanded = value;
    },
    // A new Notch window starts collapsed without discarding what is pending.
    resetExpanded() {
      expanded = false;
    },
    prune(context) {
      pending = rules.prunePending(pending, context);
    },
    canStart: (settings, sessionId, activeId) =>
      canStartAutomaticInsight({
        enabled: settings.notchEnabled,
        sessionId,
        activeSessionId: activeId,
        pending,
        lastDisplayed: last,
        minimumSeconds: settings.notchMinimumVisibleSeconds,
        now: now(),
      }),
    // `expand` runs before the pending answer is replaced, as the window expansion publishes state itself.
    offer(answer, expand) {
      const decision = rules.offerAnswer(answer);
      if (decision.expand) expand();
      if (decision.replacesPending) pending = decision.pending;
      return decision.displayAckId;
    },
    acknowledge(id, context) {
      const seen = rules.acknowledgement(pending, { ...context, id, expanded, at: now() });
      if (!seen) return false;
      last = seen;
      pending = null;
      return true;
    },
    status: (activeId) => rules.displayStatus({ pending, last, activeId }),
    snapshot: () => ({ pending, displayed: last }),
  };
}
module.exports = { createNotchState };
