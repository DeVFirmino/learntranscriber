const fs = require('node:fs/promises');
const path = require('node:path');
const { DEFAULT_FOLDER } = require('../../domain/sessions/session-note.cjs');

// Session notes on disk: the chosen folder, or LearnTranscriber/Sessions in Documents. A note never replaces another
// file; a taken name gets a number.
function sessionNoteFiles({ documents, openPath }) {
  const folder = (settings) => settings.sessionNotesFolder || path.join(documents(), ...DEFAULT_FOLDER);
  return {
    folder,
    async write(settings, name, content) {
      const directory = folder(settings);
      await fs.mkdir(directory, { recursive: true });
      const { name: base, ext } = path.parse(name);
      for (let attempt = 1; attempt < 100; attempt++) {
        const target = path.join(directory, attempt === 1 ? name : `${base} ${attempt}${ext}`);
        try {
          await fs.writeFile(target, content, { flag: 'wx' });
          return target;
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
        }
      }
      throw new Error('Too many notes with this name in the folder.');
    },
    async open(target) {
      const failure = await openPath(target);
      if (failure) throw new Error(failure);
      return true;
    },
  };
}
module.exports = { sessionNoteFiles };
