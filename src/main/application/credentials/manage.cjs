const { normalizeHeaders } = require('../../domain/providers/custom-headers.cjs');

// Saving publishes only after encryption succeeds. Public snapshots read cached header names, never secrets.
function createCredentials({ vault, changed }) {
  let headerNames = null,
    headerRevision = 0;
  async function headers() {
    const value = await vault.read('customHeaders');
    return value ? JSON.parse(value) : [];
  }
  return {
    headers,
    headerNames() {
      if (headerNames !== null) return headerNames;
      headerNames = [];
      const revision = headerRevision;
      void headers()
        .then((values) => {
          if (revision !== headerRevision || !values.length) return;
          headerNames = values.map((item) => item.key);
          changed();
        })
        .catch(() => {});
      return headerNames;
    },
    async saveHeaders(input) {
      if (!Array.isArray(input)) normalizeHeaders(input, []);
      const previousRevision = headerRevision;
      const existing = input.length ? await headers() : [];
      const next = normalizeHeaders(input, existing);
      if (previousRevision !== headerRevision) throw new Error('Credential update was superseded.');
      const revision = ++headerRevision;
      await vault.write('customHeaders', next.length ? JSON.stringify(next) : null);
      if (revision !== headerRevision) throw new Error('Credential update was superseded.');
      headerNames = next.map((item) => item.key);
      changed();
      return headerNames;
    },
    async saveKey(input) {
      if (input?.provider === 'chatgpt') throw new Error('Use Continue with ChatGPT to manage account access.');
      if (input?.provider === 'customHeaders')
        throw new Error('Save custom headers from the custom provider settings.');
      if (typeof input?.key !== 'string' || input.key.length > 20000) throw new Error('Invalid key.');
      await vault.write(input.provider, input.key || null);
      changed();
      return vault.status();
    },
  };
}
module.exports = { createCredentials };
