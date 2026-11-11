// Appends main-process errors and warnings to main.log in the app's logs folder (~/Library/Logs/LearnTranscriber on
// macOS), readable only by the user. The folder appears with the first line. Past maxBytes the file becomes
// main.old.log, so the log never holds more than two files.
const fs = require('node:fs');
const path = require('node:path');
const { logLine } = require('../../domain/shared/log-line.cjs');

function createErrorLog({ directory, now, maxBytes = 1024 * 1024 }) {
  const file = path.join(directory, 'main.log');
  return {
    write(level, parts) {
      // Logging never throws: a full disk or a locked folder must not take the app down with it.
      try {
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        if (fs.existsSync(file) && fs.statSync(file).size > maxBytes)
          fs.renameSync(file, path.join(directory, 'main.old.log'));
        fs.appendFileSync(file, logLine({ time: now(), level, parts }), { mode: 0o600 });
      } catch {}
    },
  };
}
module.exports = { createErrorLog };
