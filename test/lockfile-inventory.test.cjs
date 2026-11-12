const { test } = require('node:test');
const assert = require('node:assert/strict');
const { productionInventory, resolve } = require('../scripts/lockfile-inventory.cjs');
const UI_LOCK = require('../ui/package-lock.json');
const UI = require('../ui/package.json');

const integrity = 'sha512-' + Buffer.from('digest').toString('base64');

// A lockfile cut down to the cases the inventory has to tell apart.
const LOCK = {
  packages: {
    '': { dependencies: { app: '^1.0.0', '@scope/kit': '^2.0.0' }, devDependencies: { builder: '^1.0.0' } },
    'node_modules/app': {
      version: '1.0.0',
      license: 'MIT',
      integrity,
      resolved: 'https://registry.npmjs.org/app/-/app-1.0.0.tgz',
      dependencies: { shared: '^2.0.0', hoisted: '^1.0.0' },
      optionalDependencies: { native: '^1.0.0' },
    },
    'node_modules/app/node_modules/shared': { version: '2.0.0' },
    'node_modules/@scope/kit': {
      version: '2.1.0',
      license: '(MIT OR Apache-2.0)',
      dependencies: { shared: '^1.0.0', '@types/kit': '^2.0.0' },
      peerDependencies: { app: '^1.0.0', builder: '^1.0.0', missing: '^1.0.0' },
    },
    'node_modules/shared': { version: '1.0.0' },
    'node_modules/hoisted': { version: '1.0.0' },
    'node_modules/native': { version: '1.0.0', optional: true },
    'node_modules/@types/kit': { version: '2.0.0' },
    'node_modules/builder': { version: '1.0.0', dev: true },
  },
};

test('a name resolves next to its dependent first, then in each folder above', () => {
  const { packages } = LOCK;
  assert.equal(resolve(packages, 'node_modules/app', 'shared'), 'node_modules/app/node_modules/shared');
  assert.equal(resolve(packages, 'node_modules/@scope/kit', 'shared'), 'node_modules/shared');
  assert.equal(resolve(packages, 'node_modules/app/node_modules/shared', 'hoisted'), 'node_modules/hoisted');
  assert.equal(resolve(packages, '', 'missing'), null);
});

test('the inventory follows dependencies and peers from the root and keeps both copies of a package', () => {
  const inventory = productionInventory(LOCK);
  assert.deepEqual(inventory.dependsOn, ['app@1.0.0', '@scope/kit@2.1.0']);
  assert.deepEqual(inventory.components.map((component) => component['bom-ref']).sort(), [
    '@scope/kit@2.1.0',
    'app@1.0.0',
    'hoisted@1.0.0',
    'shared@1.0.0',
    'shared@2.0.0',
  ]);
  const of = (ref) => inventory.dependencies.find((entry) => entry.ref === ref).dependsOn;
  assert.deepEqual(of('app@1.0.0'), ['shared@2.0.0', 'hoisted@1.0.0']);
  assert.deepEqual(of('@scope/kit@2.1.0'), ['shared@1.0.0', 'app@1.0.0']);
});

test('optional dependencies, type packages and peers only a development tool installed are left out', () => {
  const refs = productionInventory(LOCK).components.map((component) => component.name);
  for (const name of ['native', '@types/kit', 'builder', 'missing']) assert.ok(!refs.includes(name), name);
});

test('a component carries its package URL, hash, license and download', () => {
  const [app, kit] = ['app', '@scope/kit'].map((name) =>
    productionInventory(LOCK).components.find((component) => component.name === name),
  );
  assert.equal(app.purl, 'pkg:npm/app@1.0.0');
  assert.deepEqual(app.hashes, [{ alg: 'SHA-512', content: Buffer.from('digest').toString('hex') }]);
  assert.deepEqual(app.licenses, [{ expression: 'MIT' }]);
  assert.deepEqual(app.externalReferences, [
    { type: 'distribution', url: 'https://registry.npmjs.org/app/-/app-1.0.0.tgz' },
  ]);
  assert.equal(kit.purl, 'pkg:npm/%40scope/kit@2.1.0');
  assert.deepEqual(kit.licenses, [{ expression: '(MIT OR Apache-2.0)' }]);
});

// The real renderer lockfile: `npm sbom` once left out these production packages, is-plain-obj among them, which the
// bundle includes through unified.
test('the renderer inventory keeps the production packages npm sbom dropped, and no development tool', () => {
  const inventory = productionInventory(UI_LOCK);
  const names = new Set(inventory.components.map((component) => component.name));
  for (const name of ['is-plain-obj', 'debug', 'ms', 'tslib']) assert.ok(names.has(name), name);
  const unified = inventory.components.find((component) => component.name === 'unified');
  const edges = inventory.dependencies.find((entry) => entry.ref === unified['bom-ref']).dependsOn;
  assert.ok(edges.some((ref) => ref.startsWith('is-plain-obj@')));
  for (const name of Object.keys(UI.devDependencies))
    assert.ok(!names.has(name) || Object.hasOwn(UI.dependencies, name), name);
});
