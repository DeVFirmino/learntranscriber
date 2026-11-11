const PROVIDERS = ['openai', 'gemini', 'openrouter', 'custom', 'chatgpt', 'customHeaders', 'smtp'];

// Ciphertext only: sealing and opening secrets belongs to the credential vault.
function credentialRepository({ db }) {
  return {
    get: (provider) => db.prepare('SELECT ciphertext FROM credentials WHERE provider=?').get(provider)?.ciphertext,
    set(provider, ciphertext) {
      if (!PROVIDERS.includes(provider)) throw new Error('Invalid provider.');
      if (ciphertext === null) db.prepare('DELETE FROM credentials WHERE provider=?').run(provider);
      else db.prepare('INSERT OR REPLACE INTO credentials VALUES (?, ?)').run(provider, ciphertext);
    },
    status: () =>
      Object.fromEntries(
        db
          .prepare('SELECT provider FROM credentials')
          .all()
          .map((row) => [row.provider, true]),
      ),
  };
}
module.exports = { credentialRepository };
