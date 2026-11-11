const { applyProposal } = require('./proposal-actions.cjs');

const validToken = (proposal) =>
  typeof proposal?.token === 'string' && proposal.token.length <= 100 ? proposal.token : null;

// Proposals can be applied only if this process issued them, at most once each. A replay returns the first
// result marked as replayed; a token that was never issued, or was evicted, is refused rather than executed
// again, so a stale proposal can never create a duplicate.
function createAppliedProposals({ limit = 200 } = {}) {
  const tokens = new Map();
  return {
    issue(proposals) {
      for (const proposal of proposals || [])
        if (validToken(proposal))
          tokens.set(proposal.token, { state: 'issued', request: JSON.stringify([proposal.tool, proposal.args]) });
      while (tokens.size > limit) tokens.delete(tokens.keys().next().value);
      return proposals;
    },
    apply(library, proposal, draft, options) {
      const token = validToken(proposal);
      if (!token) throw new Error('Unsupported builder action.');
      const entry = tokens.get(token);
      if (!entry) throw new Error('This proposal expired. Ask the builder again.');
      if (entry.request !== JSON.stringify([proposal.tool, proposal.args]))
        throw new Error('This proposal changed. Ask the builder again.');
      const fingerprint = JSON.stringify(proposal.tool === 'save_assistant_draft' ? draft : null);
      if (entry.state === 'applied') {
        if (entry.fingerprint !== fingerprint) throw new Error('This proposal changed. Ask the builder again.');
        return { result: entry.result, replayed: true };
      }
      const result = applyProposal(library, proposal, draft, options);
      tokens.set(token, { ...entry, state: 'applied', fingerprint, result });
      return { result, replayed: false };
    },
  };
}
module.exports = { createAppliedProposals };
