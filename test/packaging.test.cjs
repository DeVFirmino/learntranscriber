const { test } = require('node:test');
const assert = require('node:assert/strict');
const { packagingPlan } = require('../scripts/pack.cjs');
const { stageApplication } = require('../scripts/pack.cjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
test('packaging stages current inputs and installs locked production dependencies without touching shared modules', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'package-stage-test-'));
  try {
    const shared = path.join(root, 'shared');
    fs.mkdirSync(shared);
    fs.writeFileSync(path.join(shared, 'sentinel'), 'keep');
    fs.symlinkSync(shared, path.join(root, 'node_modules'));
    for (const name of ['src', 'ui/dist', 'assets', 'build', 'scripts', '.local/native']) {
      fs.mkdirSync(path.join(root, name), { recursive: true });
      fs.writeFileSync(path.join(root, name, 'current'), name);
    }
    fs.writeFileSync(path.join(root, 'package.json'), '{}');
    fs.writeFileSync(path.join(root, 'package-lock.json'), 'locked');
    let installs = 0;
    const install = (command, args, options) => {
      installs++;
      assert.match(command, /^npm(?:\.cmd)?$/);
      assert.deepEqual(args, ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund']);
      assert.equal(options.cwd, path.join(root, '.local/package-stage'));
      fs.mkdirSync(path.join(options.cwd, 'node_modules'), { recursive: true });
      return { status: 0 };
    };
    const stage = stageApplication(root, install);
    assert.equal(fs.readlinkSync(path.join(root, 'node_modules')), shared);
    assert.equal(fs.readFileSync(path.join(shared, 'sentinel'), 'utf8'), 'keep');
    assert.equal(fs.readFileSync(path.join(stage, 'src/current'), 'utf8'), 'src');
    assert.equal(fs.readFileSync(path.join(stage, 'ui/dist/current'), 'utf8'), 'ui/dist');
    fs.unlinkSync(path.join(root, 'src/current'));
    stageApplication(root, install);
    assert.equal(fs.existsSync(path.join(stage, 'src/current')), false);
    assert.equal(installs, 1);
    fs.writeFileSync(path.join(root, 'package-lock.json'), 'new lock');
    stageApplication(root, install);
    assert.equal(installs, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test('local DMG packaging retains development signing and never enables publishing or notarization', () => {
  const p = packagingPlan(['--dmg'], '"LearnTranscriber Dev"', {});
  assert.equal(p.identity, 'LearnTranscriber Dev');
  assert.equal(p.output, 'dist/distribution-local');
  assert.ok(p.args.includes('dmg'));
  assert.ok(p.args.includes('--config.mac.hardenedRuntime=false'));
  assert.ok(p.args.includes('--config.mac.notarize=false'));
  assert.ok(p.args.includes('--config.mac.timestamp=none'));
  assert.equal(p.args[p.args.indexOf('--publish') + 1], 'never');
});
test('release packaging fails before building without Developer ID and an owned notarization profile', () => {
  assert.throws(() => packagingPlan(['--dmg', '--release'], '"LearnTranscriber Dev"', {}), /Release requires/);
  const identity = 'Developer ID Application: Fixture (TEAM)';
  const p = packagingPlan(['--dmg', '--release'], `"${identity}"`, {
    LEARNTRANSCRIBER_DISTRIBUTION_IDENTITY: identity,
    LEARNTRANSCRIBER_NOTARY_PROFILE: 'fixture-profile',
  });
  assert.ok(p.args.includes('--config.forceCodeSigning=true'));
  assert.ok(p.args.includes('--config.mac.hardenedRuntime=true'));
  assert.ok(p.args.includes('--config.afterSign=scripts/notarize.cjs'));
  assert.ok(p.args.includes('--config.dmg.sign=true'));
  assert.equal(p.args.includes('--config.mac.timestamp=none'), false);
});
test('unknown packaging options fail and explicit output remains an argument rather than shell code', () => {
  assert.throws(() => packagingPlan(['--publish'], '', {}), /Use --dmg/);
  const p = packagingPlan(['--dmg', '--output', 'dist/review with spaces'], '', {});
  assert.ok(p.args.includes('--config.directories.output=dist/review with spaces'));
  assert.equal(p.identity, null);
});
test('a hardened rehearsal signs locally under the release runtime without notarizing or touching the local DMG', () => {
  const p = packagingPlan(['--hardened'], '"LearnTranscriber Dev"', {});
  assert.equal(p.identity, 'LearnTranscriber Dev');
  assert.equal(p.output, 'dist/hardened-rehearsal');
  assert.ok(p.args.includes('--dir'));
  assert.ok(p.args.includes('--config.mac.hardenedRuntime=true'));
  assert.ok(p.args.includes('--config.mac.notarize=false'));
  assert.equal(
    p.args.some((arg) => arg.startsWith('--config.afterSign')),
    false,
  );
  assert.ok(p.args.includes('--config.mac.entitlements=build/entitlements.rehearsal.plist'));
  assert.ok(p.args.includes('--config.mac.entitlementsInherit=build/entitlements.rehearsal.plist'));
  assert.throws(() => packagingPlan(['--hardened'], '', {}), /local "LearnTranscriber Dev"/);
  assert.throws(() => packagingPlan(['--dmg', '--release', '--hardened'], '', {}), /already enable/);
});
test('packaged builds turn off Node entry points, file:// privileges and only run the integrity-checked app archive', () => {
  const { electronFuses } = require('../package.json').build;
  assert.deepEqual(electronFuses, {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    grantFileProtocolExtraPrivileges: false,
    resetAdHocDarwinSignature: true,
  });
});

test('local packaging prefers an available Apple Development certificate over the self-signed fallback', () => {
  const identity = 'Apple Development: Fixture Developer (ABCDEFGHIJ)';
  const plan = packagingPlan([], `"LearnTranscriber Dev"\n"${identity}"`, {});
  assert.equal(plan.identity, identity);
  assert.ok(plan.args.includes(`--config.mac.identity=${identity}`));
  assert.ok(plan.args.includes('--config.forceCodeSigning=true'));
});
test('local packaging requires an explicit choice when multiple development identities are available', () => {
  const first = 'Apple Development: First (AAAAAAAAAA)';
  const second = 'Apple Development: Second (BBBBBBBBBB)';
  const identities = `"${first}"\n"${second}"`;
  assert.throws(() => packagingPlan([], identities, {}), /LEARNTRANSCRIBER_LOCAL_IDENTITY/);
  assert.equal(packagingPlan([], identities, { LEARNTRANSCRIBER_LOCAL_IDENTITY: second }).identity, second);
  assert.throws(() => packagingPlan([], identities, { LEARNTRANSCRIBER_LOCAL_IDENTITY: 'Missing' }), /not available/);
});
test('release certificate qualifiers omit the prefix rejected by electron-builder without using the local override', () => {
  const identity = 'Developer ID Application: Fixture (TEAM)';
  const plan = packagingPlan(['--dmg', '--release'], `"${identity}"`, {
    LEARNTRANSCRIBER_DISTRIBUTION_IDENTITY: identity,
    LEARNTRANSCRIBER_NOTARY_PROFILE: 'fixture-profile',
    LEARNTRANSCRIBER_LOCAL_IDENTITY: 'Missing',
  });
  assert.equal(plan.identity, identity);
  assert.ok(plan.args.includes('--config.mac.identity=Fixture (TEAM)'));
});
