const fsp = require('node:fs/promises');
const path = require('node:path');
const { writeFileAtomic } = require('../files/atomic-file.cjs');

// Writes the managed llama-server's per-launch API key where only this user can read it: a 0700 directory and a
// 0600 file (writeFileAtomic's default), so `--api-key-file` can point llama-server at it without the key ever
// appearing on the command line or in a log line.
async function writeApiKeyFile(file, key) {
  await fsp.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFileAtomic(file, key);
}

// Best-effort: called when the server stops or fails to start, so a file that is already gone is not an error.
async function removeApiKeyFile(file) {
  await fsp.rm(file, { force: true });
}

module.exports = { writeApiKeyFile, removeApiKeyFile };
