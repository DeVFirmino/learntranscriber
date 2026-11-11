function registerSettings(handle, settingsUpdate) {
  handle('settings:update', (_event, patch) => settingsUpdate.save(patch));
}
module.exports = { registerSettings };
