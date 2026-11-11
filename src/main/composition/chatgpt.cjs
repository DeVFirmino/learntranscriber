const { ChatGPTAuth } = require('../infrastructure/integrations/chatgpt-auth.cjs');
const { chatgptSessionStore } = require('../application/credentials/chatgpt-session.cjs');
const { createChatGPTAccounts } = require('../application/credentials/chatgpt-accounts.cjs');
const { registerChatGPT } = require('../interface/ipc/chatgpt.cjs');

// Builds ChatGPT sign-in over its sealed session store and the account selection, and wires them to their IPC
// channels.
function composeChatGPT({ handle, repositories, vault, requests, openExternal, changed }) {
  const { settings } = repositories;
  const session = chatgptSessionStore({ vault });
  const auth = new ChatGPTAuth(session.load, session.save, openExternal);
  const accounts = createChatGPTAccounts({
    auth: {
      state: () => auth.state(),
      login: (id) => auth.login(id),
      cancel: () => auth.cancel(),
      select: (id) => auth.select(id),
      logout: (id) => auth.logout(id),
    },
    requests,
    settings: { current: () => settings.read(), clearModel: () => settings.update({ model: '' }) },
    changed,
  });
  registerChatGPT(handle, accounts);
  return { auth, accounts };
}
module.exports = { composeChatGPT };
