const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { writeApiKeyFile, removeApiKeyFile } = require('../src/main/infrastructure/local/server-auth.cjs');

test('the key file lands at 0600 inside a 0700 directory it creates, and a rewrite keeps those modes', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lt-server-auth-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'keys', 'llm.key'),
    key = 'a'.repeat(64);
  await writeApiKeyFile(file, key);
  assert.equal(await fs.readFile(file, 'utf8'), key);
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
  assert.equal((await fs.stat(path.dirname(file))).mode & 0o777, 0o700);
  await writeApiKeyFile(file, 'b'.repeat(64));
  assert.equal(await fs.readFile(file, 'utf8'), 'b'.repeat(64));
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
});

test('removal deletes the file and is a no-op when it is already gone', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lt-server-auth-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'keys', 'llm.key');
  await writeApiKeyFile(file, 'c'.repeat(64));
  await removeApiKeyFile(file);
  await assert.rejects(fs.access(file), { code: 'ENOENT' });
  await assert.doesNotReject(removeApiKeyFile(file));
  await assert.doesNotReject(removeApiKeyFile(path.join(directory, 'keys', 'whisper.key')));
});
