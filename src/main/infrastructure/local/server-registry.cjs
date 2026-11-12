const fs = require('node:fs');
const path = require('node:path');
const { writeFileAtomicSync } = require('../files/atomic-file.cjs');

// A synchronous, whole-map snapshot of the managed servers actually running right now, so a crash leaves an
// accurate record to reap on the next launch. Writing the whole map rather than editing one entry avoids a
// read-modify-write race, since llama-server and whisper-server can start or stop independently of each other.
// writeFileAtomicSync's default mode (0600) keeps the file private, matching the API key file beside it.
function saveRunningServers(file, running) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  writeFileAtomicSync(file, JSON.stringify(running));
}

module.exports = { saveRunningServers };
