const fs = require('node:fs');
const { createHash } = require('node:crypto');

/**
 * Copies a stream into an open file while hashing it, refusing more than `maxBytes`. Returns its size, SHA-256 and
 * first four bytes. `check` runs before each chunk; `onBytes` reports the running size.
 */
async function hashedCopy(output, source, { signal, maxBytes, limitMessage, check = () => {}, onBytes = () => {} }) {
  const hash = createHash('sha256');
  let magic = Buffer.alloc(0),
    bytes = 0;
  for await (const part of source) {
    signal.throwIfAborted();
    check();
    const chunk = Buffer.from(part);
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error(limitMessage);
    if (magic.length < 4) magic = Buffer.concat([magic, chunk.subarray(0, 4 - magic.length)]);
    hash.update(chunk);
    await output.writeFile(chunk);
    onBytes(bytes);
  }
  signal.throwIfAborted();
  return { bytes, magic, sha256: hash.digest('hex') };
}

// The SHA-256 of a file on disk.
async function fileSha256(file, signal) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file, { signal })) hash.update(chunk);
  return hash.digest('hex');
}

module.exports = { hashedCopy, fileSha256 };
