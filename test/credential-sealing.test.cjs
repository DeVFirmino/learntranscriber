const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chatgptSessionStore } = require('../src/main/application/credentials/chatgpt-session.cjs');

const { credentialVault } = require('../src/main/infrastructure/credentials/safe-storage.cjs');

function fakeSafeStorage(available = true) {
  return {
    available,
    isAsyncEncryptionAvailable: async function () {
      return this.available;
    },
    encryptStringAsync: async (value) => Buffer.from(`sealed:${value}`),
    decryptStringAsync: async (bytes) => ({ result: bytes.toString().replace(/^sealed:/, ''), shouldReEncrypt: false }),
  };
}

test('the ChatGPT sign-in round-trips sealed through the async vault and is refused without secure storage', async () => {
  const stored = new Map();
  const credentials = { get: (name) => stored.get(name), set: (name, value) => stored.set(name, value) };
  const safeStorage = fakeSafeStorage();
  const vault = credentialVault({ credentials, safeStorage, timers: { setTimeout, clearTimeout } });
  const store = chatgptSessionStore({ vault });
  assert.equal(await store.load(), null);
  await store.save({ accounts: [{ id: 'a' }] });
  assert.match(stored.get('chatgpt').toString(), /^sealed:/);
  assert.deepEqual(await store.load(), { accounts: [{ id: 'a' }] });
  safeStorage.available = false;
  await assert.rejects(store.save({}), /secure credential storage is unavailable/);
});
