const UNAVAILABLE = 'macOS secure credential storage is unavailable.';
const TIMED_OUT = 'macOS is asking to allow Keychain access. Choose Always Allow in its prompt, then try again.';
const BLOCKED =
  'macOS did not let LearnTranscriber read its Keychain key. Restart the app and choose Always Allow when macOS asks.';
const SUPERSEDED = 'Credential update was superseded.';

// Electron reports a Keychain read that macOS refused or that failed as "temporarily unavailable", and keeps doing so
// until the app restarts, so the user is told to restart instead of to try again.
function keychainError(error) {
  return /temporarily unavailable|(en|de)cryption is not available/i.test(String(error?.message))
    ? new Error(BLOCKED)
    : error;
}

// Keychain access must never block the main thread. Late operations cannot overwrite a newer save or clear.
function credentialVault({ credentials, safeStorage, timers }) {
  const revisions = new Map();
  async function bounded(action) {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(action),
        new Promise((_, reject) => {
          timer = timers.setTimeout(() => reject(new Error(TIMED_OUT)), 15000);
        }),
      ]);
    } finally {
      timers.clearTimeout(timer);
    }
  }
  return {
    async read(name) {
      const data = credentials.get(name);
      if (!data) return '';
      const revision = revisions.get(name) || 0;
      const { result } = await bounded(() => safeStorage.decryptStringAsync(Buffer.from(data))).catch((error) => {
        throw keychainError(error);
      });
      if ((revisions.get(name) || 0) !== revision) throw new Error(SUPERSEDED);
      return result;
    },
    async write(name, value) {
      const revision = (revisions.get(name) || 0) + 1;
      revisions.set(name, revision);
      if (!value) {
        credentials.set(name, null);
        return;
      }
      const data = await bounded(async () => {
        if (!(await safeStorage.isAsyncEncryptionAvailable())) throw new Error(UNAVAILABLE);
        if (revisions.get(name) !== revision) throw new Error(SUPERSEDED);
        return safeStorage.encryptStringAsync(value);
      }).catch((error) => {
        throw keychainError(error);
      });
      if (revisions.get(name) !== revision) throw new Error(SUPERSEDED);
      credentials.set(name, data);
    },
    status: () => credentials.status(),
  };
}
module.exports = { credentialVault, KEYCHAIN_BLOCKED: BLOCKED, KEYCHAIN_TIMED_OUT: TIMED_OUT };
