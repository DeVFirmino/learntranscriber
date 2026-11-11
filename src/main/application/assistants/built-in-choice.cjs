const { BUILT_IN_IDS } = require('../../domain/assistants/built-in-catalog.cjs');
const { planBuiltInChoice } = require('../../domain/assistants/built-in-choice.cjs');

// Applies the onboarding choice of built-in assistants, records that it was made, and publishes once.
function createBuiltInChoice({ assistants, recordChoice, changed }) {
  return {
    choose(chosenIds) {
      const { restore, remove } = planBuiltInChoice({
        catalogIds: BUILT_IN_IDS,
        libraryIds: assistants.all().map((item) => item.id),
        chosenIds,
      });
      assistants.restoreBuiltIns(restore);
      // Restoring first keeps a chosen assistant available as the selection fallback.
      for (const id of remove) assistants.delete(id);
      recordChoice();
      changed();
      return { restored: restore, removed: remove };
    },
  };
}

module.exports = { createBuiltInChoice };
