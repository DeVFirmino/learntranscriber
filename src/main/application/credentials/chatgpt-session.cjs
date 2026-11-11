// The ChatGPT sign-in is stored only as JSON sealed by the OS keychain, through the same vault as provider keys, so it
// uses the asynchronous safeStorage methods with their timeout and never blocks the main process.
function chatgptSessionStore({ vault }) {
  return {
    async load() {
      const data = await vault.read('chatgpt');
      return data ? JSON.parse(data) : null;
    },
    async save(value) {
      await vault.write('chatgpt', JSON.stringify(value));
    },
  };
}
module.exports = { chatgptSessionStore };
