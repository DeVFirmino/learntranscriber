// The export is rendered before the dialog opens; cancelling writes nothing. `build` turns a session id into the
// file's content for the chosen format.
function createSessionExport({ build, destination }) {
  return {
    async export(owner, id, format, labels) {
      const content = build(id, format, labels);
      const path = await destination.choose(owner, format);
      if (!path) return false;
      await destination.write(path, content);
      return true;
    },
  };
}
module.exports = { createSessionExport };
