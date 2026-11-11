// Durable atomic replace: readers see the old or the new file, never a partial one,
// and the rename survives a crash once these functions return. If the rename succeeded but its directory
// could not be synced, the error carries `committed: true`: the new content is in place, so callers must
// not roll back as if the old file were still there.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function syncDirectorySync(directory) {
  let handle;
  try {
    handle = fs.openSync(directory, 'r');
    fs.fsyncSync(handle);
  } catch (error) {
    if (!['EISDIR', 'EPERM', 'EINVAL', 'EBADF'].includes(error.code)) throw error;
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
  }
}

function committedSync(target) {
  try {
    syncDirectorySync(path.dirname(target));
  } catch (error) {
    error.committed = true;
    throw error;
  }
}

function writeFileAtomicSync(target, data, mode = 0o600) {
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = fs.openSync(temporary, 'wx', mode);
    fs.writeFileSync(handle, data);
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = undefined;
    fs.renameSync(temporary, target);
    committedSync(target);
  } catch (error) {
    if (handle !== undefined) fs.closeSync(handle);
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

async function writeFileAtomic(target, data, mode = 0o600) {
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await fsp.open(temporary, 'wx', mode);
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fsp.rename(temporary, target);
    committedSync(target);
  } catch (error) {
    await handle?.close().catch(() => {});
    await fsp.rm(temporary, { force: true });
    throw error;
  }
}

module.exports = { writeFileAtomic, writeFileAtomicSync, syncDirectorySync };
