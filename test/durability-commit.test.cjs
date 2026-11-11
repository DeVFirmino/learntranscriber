const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeFileAtomicSync } = require('../src/main/infrastructure/files/atomic-file.cjs');

// Fails fsync only on directory handles, after a rename has already replaced the file.
function failDirectorySync(t, directory) {
  const open = fs.openSync,
    fsync = fs.fsyncSync,
    directories = new Set();
  fs.openSync = function (file, ...args) {
    const handle = open.call(this, file, ...args);
    if (path.resolve(String(file)) === path.resolve(directory)) directories.add(handle);
    return handle;
  };
  fs.fsyncSync = function (handle) {
    if (directories.has(handle)) throw Object.assign(new Error('EIO: i/o error, fsync'), { code: 'EIO' });
    return fsync.call(this, handle);
  };
  t.after(restore);
  function restore() {
    fs.openSync = open;
    fs.fsyncSync = fsync;
  }
  return restore;
}

test('a directory sync failure after the rename reports the replacement as committed', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lt-atomic-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const target = path.join(directory, 'catalog.json');
  fs.writeFileSync(target, 'old');
  failDirectorySync(t, directory);
  assert.throws(
    () => writeFileAtomicSync(target, 'new'),
    (error) => error.committed === true && error.code === 'EIO',
  );
  assert.equal(fs.readFileSync(target, 'utf8'), 'new', 'the caller must not roll back as if the old file remained');
});

test('a model whose catalog entry was committed keeps its file when durability is uncertain', async (t) => {
  const { LocalModels } = require('../src/main/infrastructure/local/local-models.cjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lt-models-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const models = new LocalModels(path.join(directory, 'models'), () => {});
  t.after(() => models.close());
  const source = path.join(directory, 'source.gguf');
  fs.writeFileSync(source, Buffer.concat([Buffer.from('GGUF'), Buffer.alloc(64)]));
  const persist = models.persist.bind(models);
  models.persist = () => {
    persist();
    throw Object.assign(new Error('EIO: i/o error, fsync'), { code: 'EIO', committed: true });
  };
  await assert.rejects(models.importFile('llm', source), /EIO/);
  const saved = JSON.parse(fs.readFileSync(path.join(directory, 'models', 'catalog.json'), 'utf8')).models;
  assert.equal(saved.length, 1);
  assert.ok(
    fs.existsSync(path.join(directory, 'models', saved[0].id + '.model')),
    'the catalog still points at an existing model file',
  );
});
