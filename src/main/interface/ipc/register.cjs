// Every channel answers with the same {ok,value|error} envelope after the caller and shutdown checks.
function createIpcRegistrar({ ipcMain, trusted, accepts }) {
  return function handle(channel, fn) {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        trusted(event);
        if (!accepts(channel)) throw new Error('LearnTranscriber is closing.');
        return { ok: true, value: await fn(event, ...args) };
      } catch (error) {
        const message =
          error.name === 'AbortError' || error.name === 'TimeoutError'
            ? 'Request cancelled or timed out.'
            : String(error.message || 'Operation failed.');
        return { ok: false, error: message.slice(0, 500) };
      }
    });
  };
}
module.exports = { createIpcRegistrar };
