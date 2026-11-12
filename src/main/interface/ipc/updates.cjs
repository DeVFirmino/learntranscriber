function registerUpdates(handle, updates) {
  handle('updates:state', () => updates.state());
  handle('updates:open', () => updates.open());
  handle('updates:download', () => updates.download());
  handle('updates:install', () => updates.install());
  handle('updates:later', () => updates.later());
  handle('updates:skip', (_event, tag) => updates.skip(tag));
}
module.exports = { registerUpdates };
