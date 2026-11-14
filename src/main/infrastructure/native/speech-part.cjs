const OUTPUT_LIMIT = 1048576;
const INPUT_LIMIT = 512000;
const CHUNK = 64000;

/**
 * Spawns the Apple Speech helper for one speaker of a session in one language. The helper reads PCM on stdin and
 * writes one JSON message per line. `started` settles when the caller marks the part ready or failed, or when the
 * helper exits or times out first; `onEnded` runs after a part that was ready exits.
 */
function spawnSpeechPart({ spawn, executable, sessionId, locale, speaker, readyTimeout, ...handlers }) {
  const { onMessage, onOverflow, onEnded } = handlers;
  const child = spawn(
    executable,
    ['--mode', 'session', '--session-id', sessionId, '--language', locale, '--speaker-label', speaker],
    { shell: false, stdio: ['pipe', 'pipe', 'ignore'], env: { PATH: '/usr/bin:/bin', LANG: 'en_US.UTF-8' } },
  );
  const part = { child, speaker, locale, ready: false, settled: false, buffer: '', ended: false, rejectReady: null, exit: null };
  const started = new Promise((resolve, reject) => {
    part.rejectReady = reject;
    part.resolveReady = resolve;
  });
  const timer = setTimeout(() => {
    if (!part.ready) {
      part.rejectReady(
        new Error('Apple Speech startup timed out. Check the language and macOS Speech Recognition permission.'),
      );
      child.kill('SIGTERM');
    }
  }, readyTimeout);
  part.exit = new Promise((resolve) => {
    const finish = (error) => {
      if (part.ended) return;
      part.ended = true;
      clearTimeout(timer);
      if (!part.ready && !part.settled) {
        part.settled = true;
        part.rejectReady(error || new Error('Apple Speech stopped before becoming ready.'));
      } else if (part.ready) onEnded();
      resolve();
    };
    child.once('exit', () => finish());
    child.once('error', (error) =>
      finish(
        error.code === 'ENOENT'
          ? new Error('Apple Speech helper is not built. Run npm run native:build.')
          : new Error('Apple Speech could not start.'),
      ),
    );
  });
  child.stdout.on('data', (bytes) => {
    part.buffer += bytes.toString('utf8');
    if (part.buffer.length > OUTPUT_LIMIT) {
      onOverflow();
      child.kill('SIGTERM');
      return;
    }
    let newline;
    while ((newline = part.buffer.indexOf('\n')) >= 0) {
      const line = part.buffer.slice(0, newline);
      part.buffer = part.buffer.slice(newline + 1);
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      onMessage(message);
    }
  });
  return { part, started: started.finally(() => clearTimeout(timer)) };
}

// Writes PCM to a ready part in bounded chunks, refusing it when the helper falls behind.
function writePcm(part, samples) {
  if (!part?.ready || part.ended || !part.child.stdin.writable) throw new Error('Apple Speech source is not ready.');
  if (part.child.stdin.writableLength + samples.byteLength > INPUT_LIMIT)
    throw new Error('Apple Speech is falling behind. Stop and restart listening.');
  const bytes = Buffer.from(samples);
  for (let offset = 0; offset < bytes.length; offset += CHUNK) part.child.stdin.write(bytes.subarray(offset, offset + CHUNK));
  return true;
}

// Ends a part's input so the helper can deliver its final transcript, then terminates it if it does not exit.
async function stopPart(part, timeout) {
  if (!part.ended && part.child.stdin.writable) part.child.stdin.end();
  let timer;
  await Promise.race([
    part.exit,
    new Promise((resolve) => {
      timer = setTimeout(() => {
        part.child.kill('SIGTERM');
        resolve();
      }, timeout);
    }),
  ]);
  clearTimeout(timer);
  if (!part.ended) {
    part.child.kill('SIGKILL');
    await part.exit;
  }
}

module.exports = { spawnSpeechPart, writePcm, stopPart };
