const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { writeFileAtomic, writeFileAtomicSync } = require('../src/main/infrastructure/files/atomic-file.cjs');
const { LocalModels } = require('../src/main/infrastructure/local/local-models.cjs');

function directory(t) {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-file-'));
  t.after(() => fs.rmSync(value, { recursive: true, force: true }));
  return value;
}

test('a failed export keeps the existing destination and leaves no temporary file', async (t) => {
  const dir = directory(t),
    target = path.join(dir, 'session.md');
  fs.writeFileSync(target, 'previous export');
  await assert.rejects(
    writeFileAtomic(target, {
      toString() {
        throw new Error('serialization failed');
      },
    }),
  );
  assert.equal(fs.readFileSync(target, 'utf8'), 'previous export');
  assert.deepEqual(fs.readdirSync(dir), ['session.md']);
  await writeFileAtomic(target, 'new export');
  assert.equal(fs.readFileSync(target, 'utf8'), 'new export');
  assert.equal(fs.statSync(target).mode & 0o777, 0o600);
  assert.deepEqual(fs.readdirSync(dir), ['session.md']);
});
test('synchronous replace keeps the old catalog on failure', (t) => {
  const dir = directory(t),
    target = path.join(dir, 'catalog.json');
  writeFileAtomicSync(target, '{"models":[]}');
  assert.throws(() => writeFileAtomicSync(target, Symbol('not writable')));
  assert.equal(fs.readFileSync(target, 'utf8'), '{"models":[]}');
  assert.deepEqual(fs.readdirSync(dir), ['catalog.json']);
});
test('stale catalog temporaries from a crash are removed on start', (t) => {
  const dir = directory(t);
  fs.writeFileSync(path.join(dir, '.catalog.json.11111111-2222-3333-4444-555555555555.tmp'), 'partial');
  const models = new LocalModels(dir);
  t.after(() => models.close());
  assert.equal(
    fs.readdirSync(dir).some((name) => name.endsWith('.tmp')),
    false,
  );
});
