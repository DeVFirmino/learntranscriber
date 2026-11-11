// Local builds prefer an available Apple Development identity. Release builds explicitly require Developer ID and
// a notarytool keychain profile; no signing secret is accepted on the command line or written into the project.
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { LOCAL_IDENTITY, localSigningIdentity } = require('./local-signing.cjs');
// A self-signed identity has no Team ID, so the hardened runtime's library validation would refuse Electron's own
// framework. Only the local rehearsal relaxes it; Developer ID builds share one Team ID and keep it.
const REHEARSAL_ENTITLEMENTS = 'build/entitlements.rehearsal.plist';
// Each mode builds into its own directory, so a rehearsal never replaces a reviewed artifact.
function defaultOutput({ dmg, release, hardened }) {
  if (hardened) return 'dist/hardened-rehearsal';
  if (dmg) return release ? 'dist/distribution' : 'dist/distribution-local';
  return null;
}
function packagingPlan(argv, identities, env = process.env) {
  const dmg = argv.includes('--dmg'),
    release = argv.includes('--release'),
    hardened = argv.includes('--hardened');
  let output = defaultOutput({ dmg, release, hardened });
  for (let i = 0; i < argv.length; i++) {
    if (['--dmg', '--release', '--hardened'].includes(argv[i])) continue;
    if (argv[i] === '--output' && argv[i + 1] && !argv[i + 1].startsWith('--')) output = argv[++i];
    else throw new Error('Use --dmg, --release or --hardened and optionally --output <directory>.');
  }
  if (release && !dmg) throw new Error('Release distribution requires --dmg.');
  if (release && hardened) throw new Error('Release builds already enable the hardened runtime.');
  const identity = release
    ? env.LEARNTRANSCRIBER_DISTRIBUTION_IDENTITY
    : localSigningIdentity(identities, env.LEARNTRANSCRIBER_LOCAL_IDENTITY);
  if (
    release &&
    (!identity?.startsWith('Developer ID Application:') ||
      !identities.includes(`"${identity}"`) ||
      !env.LEARNTRANSCRIBER_NOTARY_PROFILE)
  )
    throw new Error(
      'Release requires an installed Developer ID Application identity and LEARNTRANSCRIBER_NOTARY_PROFILE. Local DMG builds use --dmg without --release.',
    );
  if (hardened && !identity)
    throw new Error(`A hardened rehearsal needs an Apple Development or local "${LOCAL_IDENTITY}" signing identity.`);
  const args = [
    '--mac',
    ...(dmg ? ['dmg'] : ['--dir']),
    '--arm64',
    '--publish',
    'never',
    ...(output ? [`--config.directories.output=${output}`] : []),
    `--config.mac.identity=${identity?.replace(/^Developer ID Application:\s*/, '') || 'null'}`,
    ...(identity ? ['--config.forceCodeSigning=true'] : []),
    `--config.mac.hardenedRuntime=${release || hardened}`,
    '--config.mac.notarize=false',
    ...(!release ? ['--config.mac.timestamp=none'] : []),
  ];
  if (dmg) args.push(`--config.artifactName=LearnTranscriber-\${version}-\${arch}${release ? '' : '-local'}.\${ext}`);
  if (release) args.push('--config.dmg.sign=true', '--config.afterSign=scripts/notarize.cjs');
  if (hardened && identity === LOCAL_IDENTITY)
    args.push(
      `--config.mac.entitlements=${REHEARSAL_ENTITLEMENTS}`,
      `--config.mac.entitlementsInherit=${REHEARSAL_ENTITLEMENTS}`,
    );
  return { dmg, release, hardened, output, identity, args };
}
function notarizeArtifact(file, profile) {
  const result = JSON.parse(
    execFileSync(
      'xcrun',
      ['notarytool', 'submit', file, '--keychain-profile', profile, '--wait', '--output-format', 'json'],
      { encoding: 'utf8' },
    ),
  );
  if (result.status !== 'Accepted')
    throw new Error('Apple notarization did not accept the artifact. Inspect the notarytool submission log.');
  execFileSync('xcrun', ['stapler', 'staple', file], { stdio: 'inherit' });
  execFileSync('xcrun', ['stapler', 'validate', file], { stdio: 'inherit' });
}
// The development node_modules may point at another checkout. Build from a locked, independent production
// installation so dependency discovery cannot silently omit nested packages from the application archive.
function stageApplication(root, install = spawnSync) {
  const stage = path.join(root, '.local/package-stage');
  fs.mkdirSync(stage, { recursive: true });
  for (const name of ['src', 'ui/dist', 'assets', 'build', 'scripts', '.local/native']) {
    const destination = path.join(stage, name);
    fs.rmSync(destination, { recursive: true, force: true });
    fs.cpSync(path.join(root, name), destination, { recursive: true });
  }
  const fingerprint = createHash('sha256');
  for (const name of ['package.json', 'package-lock.json']) {
    const contents = fs.readFileSync(path.join(root, name));
    fingerprint.update(contents);
    fs.writeFileSync(path.join(stage, name), contents);
  }
  const stamp = path.join(stage, '.production-install');
  const digest = fingerprint.digest('hex');
  if (
    !fs.existsSync(path.join(stage, 'node_modules')) ||
    !fs.existsSync(stamp) ||
    fs.readFileSync(stamp, 'utf8') !== digest
  ) {
    const result = install(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
      { cwd: stage, stdio: 'inherit' },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('Could not install locked production packaging dependencies.');
    fs.writeFileSync(stamp, digest);
  }
  return stage;
}
function describe(plan) {
  if (plan.release) return 'Building Developer ID distribution.';
  if (plan.hardened) return 'Building a local hardened-runtime rehearsal.';
  return plan.identity ? 'Building with the local development identity.' : 'Building an unsigned local package.';
}
function run() {
  let identities = '';
  try {
    identities = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' });
  } catch {}
  const plan = packagingPlan(process.argv.slice(2), identities);
  console.log(describe(plan));
  const builder = path.join(path.dirname(require.resolve('electron-builder/package.json')), 'cli.js');
  const root = path.resolve(__dirname, '..');
  const stage = stageApplication(root);
  const result = spawnSync(
    process.execPath,
    [
      builder,
      ...plan.args.filter((arg) => !arg.startsWith('--config.directories.output=')),
      '--projectDir',
      stage,
      `--config.directories.output=${path.resolve(root, plan.output || 'dist')}`,
    ],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    return;
  }
  if (plan.dmg) {
    const { version } = require('../package.json');
    const file = path.resolve(plan.output, `LearnTranscriber-${version}-arm64${plan.release ? '' : '-local'}.dmg`);
    if (plan.release) {
      notarizeArtifact(file, process.env.LEARNTRANSCRIBER_NOTARY_PROFILE);
      execFileSync('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', file], {
        stdio: 'inherit',
      });
    }
    fs.writeFileSync(
      `${file}.sha256`,
      `${createHash('sha256').update(fs.readFileSync(file)).digest('hex')}  ${path.basename(file)}\n`,
    );
    console.log(`DMG: ${file}`);
  }
}
if (require.main === module) run();
module.exports = { packagingPlan, notarizeArtifact, stageApplication };
