// Lists what notarization would reject in a signed app before anything is uploaded.
// https://developer.apple.com/documentation/security/resolving-common-notarization-issues
const path = require('node:path');
const { machOFiles } = require('./mach-o.cjs');
const { readSignature, verifiesStrictly } = require('./code-signature.cjs');
function signatureBlockers(signature, requireTimestamp) {
  if (!signature.signed) return ['not signed'];
  const blockers = [];
  if (signature.executable && !signature.hardenedRuntime) blockers.push('hardened runtime is off');
  if (requireTimestamp && !signature.timestamped) blockers.push('no secure timestamp');
  if (signature.debuggable) blockers.push('get-task-allow entitlement');
  return blockers;
}
function notarizationBlockers(
  app,
  { requireTimestamp = true, binaries = machOFiles, signatureOf = readSignature, verify = verifiesStrictly } = {},
) {
  const blockers = binaries(app).flatMap((file) =>
    signatureBlockers(signatureOf(file), requireTimestamp).map((reason) => `${path.relative(app, file)}: ${reason}`),
  );
  if (!verify(app)) blockers.push('codesign --verify --deep --strict failed');
  return blockers;
}
function main(argv) {
  const [app] = argv;
  if (!app?.endsWith('.app')) {
    console.error('Usage: node scripts/signing/notarization-preflight.cjs <App.app> [--no-timestamp]');
    return 2;
  }
  const blockers = notarizationBlockers(path.resolve(app), { requireTimestamp: !argv.includes('--no-timestamp') });
  for (const blocker of blockers) console.error(`✖ ${blocker}`);
  console.log(blockers.length ? `${blockers.length} notarization blockers.` : 'No notarization blockers found.');
  return blockers.length ? 1 : 0;
}
if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { notarizationBlockers };
