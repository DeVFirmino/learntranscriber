// Finds the Mach-O binaries in a bundle by their magic number, so resources and archives are never inspected.
const fs = require('node:fs');
const path = require('node:path');
const MAGIC = new Set(['feedface', 'cefaedfe', 'feedfacf', 'cffaedfe', 'cafebabe', 'bebafeca']);
function isMachO(file) {
  const magic = Buffer.alloc(4);
  const handle = fs.openSync(file, 'r');
  try {
    return fs.readSync(handle, magic, 0, magic.length, 0) === magic.length && MAGIC.has(magic.toString('hex'));
  } finally {
    fs.closeSync(handle);
  }
}
// Symbolic links (a framework's `Current` version) are not followed, so each binary is listed once.
function machOFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return machOFiles(file);
    return entry.isFile() && isMachO(file) ? [file] : [];
  });
}
module.exports = { machOFiles };
