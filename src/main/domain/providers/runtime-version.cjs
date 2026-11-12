// llama-server prints its build on one line to stderr, e.g. "version: 0.7.0 (build 11669, commit 620d2225c)".
// whisper-server has no --version flag: it answers with backend init lines or a usage error instead, so only a
// recognisable "version:" line counts as a version; anything else, including a clean exit with no such line, is
// reported as 'unknown' rather than guessed from the first line of unrelated output.
const VERSION_LINE = /^version:\s*(\S.*)$/im;

function parseRuntimeVersion(output) {
  const match = VERSION_LINE.exec(String(output ?? ''));
  return match ? match[1].trim() : 'unknown';
}

module.exports = { parseRuntimeVersion };
