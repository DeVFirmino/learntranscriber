function registerCredentials(handle, credentials) {
  handle('providers:custom-headers', (_event, input) => credentials.saveHeaders(input));
  handle('credentials:save', (_event, input) => credentials.saveKey(input));
}
module.exports = { registerCredentials };
