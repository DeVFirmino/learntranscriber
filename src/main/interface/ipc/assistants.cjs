const MAX_CHOSEN = 20;

function registerAssistantLibrary(handle, library, builtIns) {
  handle('assistants:save', (_event, input) => library.save(input));
  handle('assistants:choose-built-ins', (_event, ids) => {
    if (!Array.isArray(ids) || ids.length > MAX_CHOSEN || ids.some((id) => typeof id !== 'string' || id.length > 100))
      throw new Error('Choose built-in assistants from the catalog.');
    return builtIns.choose(ids);
  });
  handle('assistants:delete', (_event, id) => library.delete(id));
  handle('assistants:export', (_event, id) => library.export(id));
  handle('assistants:import', (_event, input) => library.import(input));
}
module.exports = { registerAssistantLibrary };
