const nameKey = (name) => name.normalize('NFKC').trim().toLowerCase();

function assertAvailableName(name, id, library) {
  if (library.some((item) => item.id !== id && nameKey(item.name) === nameKey(name)))
    throw new Error('An assistant with this name already exists. Choose another name.');
}

// Existing duplicates retain their identity and prompts; only the display name gains a suffix.
function availableName(name, library) {
  const used = new Set(library.map((item) => nameKey(item.name)));
  if (!used.has(nameKey(name))) return name;
  for (let number = 2; ; number++) {
    const suffix = ` (${number})`;
    const candidate = name.trim().slice(0, 80 - suffix.length) + suffix;
    if (!used.has(nameKey(candidate))) return candidate;
  }
}

module.exports = { nameKey, assertAvailableName, availableName };
