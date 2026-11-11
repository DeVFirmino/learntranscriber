function registerChatGPT(handle, accounts) {
  handle('chatgpt:login', (_event, id) => accounts.login(id));
  handle('chatgpt:cancel', () => accounts.cancel());
  handle('chatgpt:select', (_event, id) => accounts.select(id));
  handle('chatgpt:logout', (_event, id) => accounts.logout(id));
}
module.exports = { registerChatGPT };
