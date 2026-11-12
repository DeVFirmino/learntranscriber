const { test } = require('node:test');
const assert = require('node:assert/strict');
const { releaseSbom, swiftComponents } = require('../scripts/sbom.cjs');

const RESOLVED = {
  pins: [
    {
      identity: 'swift-argument-parser',
      kind: 'remoteSourceControl',
      location: 'https://github.com/apple/swift-argument-parser',
      state: { revision: '6a52f3251125d74daf04fcbd5e6f08a75d074382', version: '1.8.2' },
    },
  ],
  version: 3,
};

// The renderer package and the inventory lockfile-inventory.cjs reads from its lockfile, cut to one package.
const RENDERER = {
  name: 'learntranscriber-ui',
  version: '0.0.0',
  inventory: {
    dependsOn: ['react@19.2.0'],
    components: [
      { 'bom-ref': 'react@19.2.0', type: 'library', name: 'react', version: '19.2.0', purl: 'pkg:npm/react@19.2.0' },
    ],
    dependencies: [{ ref: 'react@19.2.0', dependsOn: [] }],
  },
};

const sbom = () =>
  releaseSbom({
    version: '0.1.1',
    electronVersion: '45.3.0',
    renderer: RENDERER,
    resolved: RESOLVED,
    serialNumber: '00000000-0000-4000-8000-000000000000',
    timestamp: '2026-11-11T12:00:00.000Z',
  });

test('a Swift pin becomes a component with its package URL and the revision built', () => {
  assert.deepEqual(swiftComponents(RESOLVED), [
    {
      'bom-ref': 'swift:swift-argument-parser@1.8.2',
      type: 'library',
      name: 'swift-argument-parser',
      version: '1.8.2',
      purl: 'pkg:swift/github.com/apple/swift-argument-parser@1.8.2',
      externalReferences: [{ type: 'vcs', url: 'https://github.com/apple/swift-argument-parser' }],
      properties: [{ name: 'swift:revision', value: '6a52f3251125d74daf04fcbd5e6f08a75d074382' }],
    },
  ]);
});

test('the release is the subject of a CycloneDX 1.5 document', () => {
  const document = sbom();
  assert.equal(document.bomFormat, 'CycloneDX');
  assert.equal(document.specVersion, '1.5');
  assert.equal(document.serialNumber, 'urn:uuid:00000000-0000-4000-8000-000000000000');
  assert.deepEqual(document.metadata.lifecycles, [{ phase: 'build' }]);
  assert.equal(document.metadata.component.name, 'LearnTranscriber');
  assert.equal(document.metadata.component.version, '0.1.1');
  assert.equal(document.metadata.component.purl, 'pkg:github/DeVFirmino/learntranscriber@v0.1.1');
});

test('the app is built from the renderer, Electron and the three helpers, and the helpers from the Swift pins', () => {
  const { dependencies } = sbom();
  const of = (ref) => dependencies.find((entry) => entry.ref === ref).dependsOn;
  assert.deepEqual(of('learntranscriber@0.1.1'), [
    'learntranscriber-ui@0.0.0',
    'electron@45.3.0',
    'helper:apple-speech@0.1.1',
    'helper:context-helper@0.1.1',
    'helper:system-audio@0.1.1',
  ]);
  for (const helper of ['apple-speech', 'context-helper', 'system-audio'])
    assert.deepEqual(of(`helper:${helper}@0.1.1`), ['swift:swift-argument-parser@1.8.2']);
  assert.deepEqual(of('learntranscriber-ui@0.0.0'), ['react@19.2.0']);
});

test('Electron is listed as the framework with its npm package URL', () => {
  const electron = sbom().components.find((component) => component.name === 'electron');
  assert.equal(electron.type, 'framework');
  assert.equal(electron.purl, 'pkg:npm/electron@45.3.0');
});

test('every reference in the dependency graph names a listed component or the app', () => {
  const document = sbom();
  const known = new Set([document.metadata.component['bom-ref'], ...document.components.map((c) => c['bom-ref'])]);
  for (const { ref, dependsOn } of document.dependencies)
    for (const name of [ref, ...dependsOn]) assert.ok(known.has(name), name);
  assert.equal(known.size, document.components.length + 1, 'no component is listed twice');
});
