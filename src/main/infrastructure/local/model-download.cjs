const { MAX_MODEL_BYTES, downloadUrl, redirectTarget } = require('../../domain/providers/local-server.cjs');

const REDIRECTS = [301, 302, 303, 307, 308];

// Opens a model download, following at most five HTTPS redirects, and refuses anything over 32 GB.
async function fetchArtifact(fetch, value, signal) {
  const url = downloadUrl(value);
  let response,
    current = url;
  for (let i = 0; i < 6; i++) {
    response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.any([signal, AbortSignal.timeout(30 * 60000)]),
    });
    if (!REDIRECTS.includes(response.status)) break;
    const location = response.headers.get('location');
    await response.body?.cancel();
    current = redirectTarget(location, current);
  }
  if (!response.ok) throw new Error(`Model download failed (HTTP ${response.status}).`);
  const size = Number(response.headers.get('content-length')) || 0;
  if (size > MAX_MODEL_BYTES) {
    await response.body?.cancel();
    throw new Error('Model exceeds the 32 GB download limit.');
  }
  return { body: response.body, size, url };
}

module.exports = { fetchArtifact };
