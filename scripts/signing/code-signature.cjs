// Reads what macOS reports about a binary's signature through codesign and file.
const { spawnSync } = require('node:child_process');
// codesign writes signature details to stderr, so both streams are read.
function execute(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return { status: result.status, text: `${result.stdout || ''}${result.stderr || ''}` };
}
function parseSignature({ details, entitlements, kind }) {
  return {
    signed: !/not signed at all/.test(details),
    executable: /\bexecutable\b/.test(kind),
    hardenedRuntime: /flags=0x[0-9a-f]+\([^)]*\bruntime\b/.test(details),
    timestamped: /^Timestamp=/m.test(details),
    debuggable: /com\.apple\.security\.get-task-allow/.test(entitlements),
  };
}
function readSignature(file, run = execute) {
  return parseSignature({
    details: run('codesign', ['-dv', '--verbose=4', file]).text,
    entitlements: run('codesign', ['-d', '--entitlements', ':-', file]).text,
    kind: run('file', ['-b', file]).text,
  });
}
function verifiesStrictly(app, run = execute) {
  return run('codesign', ['--verify', '--deep', '--strict', app]).status === 0;
}
module.exports = { parseSignature, readSignature, verifiesStrictly };
