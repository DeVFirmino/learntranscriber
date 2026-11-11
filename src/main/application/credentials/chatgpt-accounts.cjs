// ChatGPT account access. Changing which account is in use cancels every running request first, so no answer
// is billed to the account the user just left; status is refreshed even when sign-in fails.
function createChatGPTAccounts({ auth, requests, settings, changed, log = (message) => console.error(message) }) {
  let status = { accounts: [], activeId: null, pending: false };
  return {
    status: () => status,
    async refresh() {
      status = await auth.state();
      return status;
    },
    // At startup a keychain that refuses the stored sign-in, such as a denied password prompt, leaves ChatGPT
    // signed out instead of stopping the app.
    async restore() {
      try {
        return await this.refresh();
      } catch (error) {
        log(`ChatGPT sign-in could not be restored: ${error?.message || error}`);
        return status;
      }
    },
    async login(id) {
      try {
        const result = await auth.login(id);
        requests.cancelAll();
        return result;
      } finally {
        status = await auth.state();
        changed();
      }
    },
    cancel() {
      auth.cancel();
      return true;
    },
    async select(id) {
      requests.cancelAll();
      status = await auth.select(id);
      if (settings.current().provider === 'chatgpt') settings.clearModel();
      changed();
      return status;
    },
    async logout(id) {
      requests.cancelAll();
      const result = await auth.logout(id);
      status = result.state;
      changed();
      return result;
    },
  };
}
module.exports = { createChatGPTAccounts };
