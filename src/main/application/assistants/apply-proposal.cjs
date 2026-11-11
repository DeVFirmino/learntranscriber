// Applying a reviewed builder proposal is idempotent by token; only the first application publishes.
function createProposalApplication({ applied, library, saveSettings, changed }) {
  return {
    apply({ proposal, draft }) {
      const { result, replayed } = applied.apply(library, proposal, draft, { saveSettings });
      if (!replayed) changed();
      return result;
    },
  };
}
module.exports = { createProposalApplication };
