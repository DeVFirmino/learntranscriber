// Selected text and screen text belong to the session that was live when capture started; if the live session
// changes meanwhile, the result is discarded.
function createContextCapture({ active, nativeContext, screenshot }) {
  async function forLiveSession(missing, changed, read) {
    if (!active.id()) throw new Error(missing);
    const sessionId = active.id(),
      result = await read();
    if (active.id() !== sessionId) throw new Error(changed);
    return { ...result, sessionId };
  }
  return {
    status: () => nativeContext.status(),
    selection: () =>
      forLiveSession(
        'Start a session before reading selected text.',
        'The session changed during selection capture.',
        () => nativeContext.selection(),
      ),
    ocr: () =>
      forLiveSession(
        'Start a session before extracting screen text.',
        'The session changed during text extraction.',
        async () => nativeContext.ocr((await screenshot()).toPNG()),
      ),
  };
}
module.exports = { createContextCapture };
