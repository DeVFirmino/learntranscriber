const { providerFailure } = require('./provider-failure.cjs');
const { isConnectionFailure, DROPPED_MESSAGE } = require('../../domain/shared/connection-failure.cjs');

// A connection that drops while the answer streams in is reported as such, not as Node's "terminated".
async function readChunk(reader) {
  try {
    return await reader.read();
  } catch (error) {
    if (isConnectionFailure(error)) throw new Error(DROPPED_MESSAGE, { cause: error });
    throw error;
  }
}

// Server-sent events from a provider response, bounded to 4 MB per frame, and HTTP status checks.
async function* sse(response) {
  if (!response.body) throw new Error('Provider returned no response stream.');
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await readChunk(reader);
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      let match;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const data = block
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (data === '[DONE]') return;
        if (data) yield JSON.parse(data);
      }
      if (done) break;
      if (buffer.length > 4 * 1024 * 1024) throw new Error('Provider stream frame is too large.');
    }
    const trailing = buffer
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (trailing && trailing !== '[DONE]') yield JSON.parse(trailing);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
async function requireOk(response, provider) {
  if (response.ok) return response;
  await response.body?.cancel().catch(() => {});
  throw new Error(providerFailure(response.status, provider));
}
module.exports = { sse, requireOk };
