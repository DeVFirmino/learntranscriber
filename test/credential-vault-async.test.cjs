const test = require('node:test');
const assert = require('node:assert/strict');
const { credentialVault, KEYCHAIN_BLOCKED } = require('../src/main/infrastructure/credentials/safe-storage.cjs');
const timers = { setTimeout: () => 1, clearTimeout() {} };
function storage() {
  const values = new Map();
  return { get: (name) => values.get(name), set: (name, value) => values.set(name, value), status: () => ({}) };
}
function keychain(overrides = {}) {
  const sync = () => {
    throw new Error('Synchronous Keychain access would block the app');
  };
  return {
    isEncryptionAvailable: sync,
    encryptString: sync,
    decryptString: sync,
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async (value) => Buffer.from('sealed:' + value),
    decryptStringAsync: async (value) => ({ result: value.toString().slice(7), shouldReEncrypt: false }),
    ...overrides,
  };
}
test('credential writes and legacy reads use the non-blocking Electron APIs exclusively', async () => {
  const credentials = storage();
  const vault = credentialVault({ credentials, safeStorage: keychain(), timers });
  await vault.write('openai', 'fixture-value');
  assert.equal(await vault.read('openai'), 'fixture-value');
  assert.equal(credentials.get('openai').toString(), 'sealed:fixture-value');
});

test('a Keychain timeout rejects without storing a late result', async () => {
  const credentials = storage();
  let expire, finish;
  const clock = {
    setTimeout(callback) {
      expire = callback;
      return 1;
    },
    clearTimeout() {},
  };
  const vault = credentialVault({
    credentials,
    timers: clock,
    safeStorage: keychain({
      encryptStringAsync: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    }),
  });
  const saving = vault.write('openai', 'fixture-value');
  await Promise.resolve();
  await Promise.resolve();
  expire();
  await assert.rejects(saving, /macOS is asking to allow Keychain access/);
  finish(Buffer.from('late ciphertext'));
  await Promise.resolve();
  assert.equal(credentials.get('openai'), undefined);
});
test('clearing a credential supersedes a pending encryption without resurrecting the key', async () => {
  const credentials = storage();
  let finish;
  const vault = credentialVault({
    credentials,
    timers,
    safeStorage: keychain({
      encryptStringAsync: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    }),
  });
  const saving = vault.write('openai', 'fixture-value');
  await Promise.resolve();
  await Promise.resolve();
  await vault.write('openai', null);
  finish(Buffer.from('old ciphertext'));
  await assert.rejects(saving, /superseded/);
  assert.equal(credentials.get('openai'), null);
});
test('unavailable storage leaves an existing credential intact and still permits clearing', async () => {
  const credentials = storage();
  credentials.set('openai', Buffer.from('existing encrypted value'));
  const vault = credentialVault({
    credentials,
    timers,
    safeStorage: keychain({ isAsyncEncryptionAvailable: async () => false }),
  });
  await assert.rejects(vault.write('openai', 'new value'), /unavailable/);
  assert.equal(credentials.get('openai').toString(), 'existing encrypted value');
  await vault.write('openai', null);
  assert.equal(credentials.get('openai'), null);
});
test('a decrypt started before clearing cannot return the old credential afterward', async () => {
  const credentials = storage();
  credentials.set('openai', Buffer.from('legacy encrypted value'));
  let finish;
  const vault = credentialVault({
    credentials,
    timers,
    safeStorage: keychain({
      decryptStringAsync: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    }),
  });
  const reading = vault.read('openai');
  await Promise.resolve();
  await vault.write('openai', null);
  finish({ result: 'old value', shouldReEncrypt: false });
  await assert.rejects(reading, /superseded/);
});

test('existing ciphertext reaches the async decryptor unchanged and is not rewritten during a read', async () => {
  const credentials = storage();
  const legacy = Buffer.from('legacy cipher fixture');
  credentials.set('openai', legacy);
  const vault = credentialVault({
    credentials,
    timers,
    safeStorage: keychain({
      decryptStringAsync: async (bytes) => {
        assert.deepEqual(bytes, legacy);
        return { result: 'legacy fixture value', shouldReEncrypt: true };
      },
    }),
  });
  assert.equal(await vault.read('openai'), 'legacy fixture value');
  assert.equal(credentials.get('openai'), legacy);
});

test('a Keychain read macOS refused tells the user to restart and allow access, for reads and writes', async () => {
  const credentials = storage();
  credentials.set('openai', Buffer.from('sealed:fixture-value'));
  const refused = () =>
    Promise.reject(new Error('safeStorage.decryptStringAsync is temporarily unavailable. Please try again.'));
  const vault = credentialVault({
    credentials,
    safeStorage: keychain({
      decryptStringAsync: refused,
      encryptStringAsync: () => Promise.reject(new Error('Encryption is not available.')),
    }),
    timers,
  });
  await assert.rejects(vault.read('openai'), (error) => error.message === KEYCHAIN_BLOCKED);
  await assert.rejects(vault.write('gemini', 'key'), (error) => error.message === KEYCHAIN_BLOCKED);
  const other = credentialVault({
    credentials,
    safeStorage: keychain({ decryptStringAsync: () => Promise.reject(new Error('Malformed ciphertext.')) }),
    timers,
  });
  await assert.rejects(other.read('openai'), /Malformed ciphertext/);
});
