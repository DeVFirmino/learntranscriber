const { test } = require('node:test');
const assert = require('node:assert/strict');
const { localSigningIdentity } = require('../scripts/local-signing.cjs');
test('local signing falls back to the existing development identity or stays unsigned', () => {
  assert.equal(localSigningIdentity('"LearnTranscriber Dev"'), 'LearnTranscriber Dev');
  assert.equal(localSigningIdentity('0 valid identities found'), null);
  assert.equal(localSigningIdentity('"Developer ID Application: Other (TEAM)"'), null);
});
test('explicit local signing must identify exactly one valid certificate', () => {
  const name = 'Apple Development: Developer (TEAM)';
  assert.equal(localSigningIdentity(`"${name}"`, ` ${name} `), name);
  assert.throws(() => localSigningIdentity(`"${name}"\n"${name}"`, name), /ambiguous/);
  assert.throws(() => localSigningIdentity(`"${name}"`, 'Missing'), /not available/);
});
test('development-signed hardened builds keep the standard entitlements', () => {
  const { packagingPlan } = require('../scripts/pack.cjs');
  const plan = packagingPlan(['--hardened'], '"Apple Development: Developer (TEAM)"', {});
  assert.ok(plan.args.includes('--config.mac.hardenedRuntime=true'));
  assert.equal(
    plan.args.some((arg) => arg.includes('entitlements.rehearsal.plist')),
    false,
  );
});
