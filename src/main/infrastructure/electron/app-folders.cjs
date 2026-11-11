const fs = require('node:fs');

// The app's own folders that Settings › Data opens in Finder: the workspace data and the error logs. The logs folder
// appears with the first error, so it is created first, private to the user, and the button never fails on it.
const PATHS = { data: 'userData', logs: 'logs' };

function createAppFolders({ app, shell }) {
  return {
    async reveal(name) {
      const folder = app.getPath(PATHS[name]);
      fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
      const failure = await shell.openPath(folder);
      if (failure) throw new Error('Could not open the folder in Finder.');
      return true;
    },
  };
}
module.exports = { createAppFolders };
