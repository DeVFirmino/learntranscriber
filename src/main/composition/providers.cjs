const { createCredentials } = require('../application/credentials/manage.cjs');
const { credentialVault } = require('../infrastructure/credentials/safe-storage.cjs');
const { Providers } = require('../infrastructure/providers/index.cjs');
const { reachingFetch } = require('../infrastructure/providers/reaching-fetch.cjs');

// Provider access: the keys sealed by the system keychain, the custom headers, and the providers that send them. A
// ChatGPT account signs its requests with its own token instead of a key.
function composeProviders({ credentials: stored, safeStorage, chatgptToken, changed, timers }) {
  const vault = credentialVault({
    credentials: {
      get: (name) => stored().get(name),
      set: (name, value) => stored().set(name, value),
      status: () => stored().status(),
    },
    safeStorage,
    timers,
  });
  const credentials = createCredentials({ vault, changed });
  const providers = new Providers(
    async (provider) => (provider === 'chatgpt' ? chatgptToken() : vault.read(provider)),
    reachingFetch(fetch),
    async () => credentials.headers(),
  );
  return { vault, credentials, providers };
}
module.exports = { composeProviders };
