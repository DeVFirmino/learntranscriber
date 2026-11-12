const { parseRuntimeVersion } = require('../../domain/providers/runtime-version.cjs');

// Keeps only what the executable needs to report its own version, nothing else from the user's shell or profile.
const ENV_KEYS = ['PATH', 'HOME', 'LANG'];

/**
 * Runs `binary --version` to record which build is installed. `execFile` is a promisified node:child_process
 * execFile (no shell). Any failure (missing binary, non-zero exit, timeout) or output with no recognisable
 * version line becomes 'unknown' rather than failing the install, the binary choice or the server start that
 * asked for it.
 */
async function captureVersion({ execFile, binary, timeoutMs = 3000 }) {
  const env = Object.fromEntries(ENV_KEYS.filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  try {
    const { stdout, stderr } = await execFile(binary, ['--version'], { timeout: timeoutMs, env });
    return parseRuntimeVersion(`${stdout}\n${stderr}`);
  } catch {
    return 'unknown';
  }
}

module.exports = { captureVersion };
