// The export is rendered before the dialog opens; cancelling writes nothing.
function createSessionExport({ sessions, destination }) {
  return {
    async export(owner, id) {
      const content = sessions.markdown(id);
      const path = await destination.choose(owner);
      if (!path) return false;
      await destination.write(path, content);
      return true;
    },
  };
}
module.exports = { createSessionExport };
