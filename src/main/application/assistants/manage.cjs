const { exportAssistant, importAssistant } = require('../../domain/assistants/package.cjs');

// Saving or deleting publishes once after it succeeds; export copies the package and import only returns a draft.
function createAssistantLibrary({ assistants, clipboard, changed }) {
  return {
    save(input) {
      const id = assistants.save(input);
      changed();
      return id;
    },
    delete(id) {
      const result = assistants.delete(id);
      changed();
      return result;
    },
    async export(id) {
      await clipboard.writeText(exportAssistant(assistants.all().find((item) => item.id === id)));
      return true;
    },
    import: (input) => importAssistant(input),
  };
}
module.exports = { createAssistantLibrary };
