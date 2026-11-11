const fs = require('node:fs');
const path = require('node:path');
const { writeFileAtomicSync } = require('../files/atomic-file.cjs');

// Leftovers of interrupted imports, downloads and catalog writes.
const PARTIALS = [
  /^[a-f0-9-]{36}\.model\.partial$/,
  /^[a-f0-9-]{36}-[a-f0-9-]{36}\.mmproj\.partial$/,
  /^\.catalog\.json\.[a-f0-9-]{36}\.tmp$/,
];

/**
 * Opens the local models directory: removes leftovers of interrupted writes and reads catalog.json, refusing to
 * start over on an unreadable one so the user can preserve it.
 */
function openCatalog(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const name of fs.readdirSync(directory))
    if (PARTIALS.some((pattern) => pattern.test(name))) fs.rmSync(path.join(directory, name), { force: true });
  const file = path.join(directory, 'catalog.json');
  try {
    const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(catalog.models) || !catalog.binaries) throw new Error();
    return { file, catalog };
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Local model catalog is unreadable. Preserve it before repairing.');
    return { file, catalog: { models: [], binaries: {} } };
  }
}

const saveCatalog = (file, catalog) => writeFileAtomicSync(file, JSON.stringify(catalog));

module.exports = { openCatalog, saveCatalog };
