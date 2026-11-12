// Writes the CycloneDX SBOM of a release: what ships inside LearnTranscriber.app. The main process has no runtime npm
// packages; the renderer's production packages come from ui/package-lock.json (lockfile-inventory.cjs). To those it
// adds the Electron runtime and the native helpers with the Swift packages pinned in native/Package.resolved.
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { productionInventory } = require('./lockfile-inventory.cjs');

const ROOT = path.resolve(__dirname, '..');
const REPOSITORY = 'DeVFirmino/learntranscriber';
// Every helper links swift-argument-parser through CommandKit (native/Package.swift).
const HELPERS = ['apple-speech', 'context-helper', 'system-audio'];
const MIT = [{ license: { id: 'MIT' } }];

// The Swift packages pinned in Package.resolved, with package URLs and the exact revision built.
function swiftComponents(resolved) {
  return resolved.pins.map(({ identity, location, state }) => {
    const source = new URL(location);
    const repository = source.pathname.replace(/^\/+/, '').replace(/\.git$/, '');
    return {
      'bom-ref': `swift:${identity}@${state.version}`,
      type: 'library',
      name: identity,
      version: state.version,
      purl: `pkg:swift/${source.host}/${repository}@${state.version}`,
      externalReferences: [{ type: 'vcs', url: location }],
      properties: [{ name: 'swift:revision', value: state.revision }],
    };
  });
}

// The release document: the app as its subject, and the renderer with its npm packages, Electron and the helpers as
// the parts it is built from.
function releaseSbom({ version, electronVersion, renderer, resolved, serialNumber, timestamp }) {
  const app = `learntranscriber@${version}`;
  const ui = {
    'bom-ref': `${renderer.name}@${renderer.version}`,
    type: 'application',
    name: renderer.name,
    version: renderer.version,
    purl: `pkg:npm/${renderer.name}@${renderer.version}`,
  };
  const electron = {
    'bom-ref': `electron@${electronVersion}`,
    type: 'framework',
    name: 'electron',
    version: electronVersion,
    purl: `pkg:npm/electron@${electronVersion}`,
    licenses: MIT,
  };
  const swift = swiftComponents(resolved);
  const helpers = HELPERS.map((name) => ({
    'bom-ref': `helper:${name}@${version}`,
    type: 'application',
    name,
    version,
    licenses: MIT,
  }));
  return {
    $schema: 'http://cyclonedx.org/schema/bom-1.5.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${serialNumber}`,
    version: 1,
    metadata: {
      timestamp,
      lifecycles: [{ phase: 'build' }],
      component: {
        'bom-ref': app,
        type: 'application',
        name: 'LearnTranscriber',
        version,
        purl: `pkg:github/${REPOSITORY}@v${version}`,
        licenses: MIT,
      },
    },
    components: [ui, electron, ...helpers, ...swift, ...renderer.inventory.components],
    dependencies: [
      { ref: app, dependsOn: [ui['bom-ref'], electron['bom-ref'], ...helpers.map((helper) => helper['bom-ref'])] },
      { ref: electron['bom-ref'], dependsOn: [] },
      ...helpers.map((helper) => ({ ref: helper['bom-ref'], dependsOn: swift.map((library) => library['bom-ref']) })),
      ...swift.map((library) => ({ ref: library['bom-ref'], dependsOn: [] })),
      { ref: ui['bom-ref'], dependsOn: renderer.inventory.dependsOn },
      ...renderer.inventory.dependencies,
    ],
  };
}

function run() {
  const { version } = require('../package.json');
  const ui = require('../ui/package.json');
  // The installed Electron is the one electron-builder packages.
  const electronVersion = require('electron/package.json').version;
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui/package-lock.json'), 'utf8'));
  const resolved = JSON.parse(fs.readFileSync(path.join(ROOT, 'native/Package.resolved'), 'utf8'));
  const output = path.resolve(process.argv[2] || path.join(ROOT, 'dist', `LearnTranscriber-${version}-sbom.cdx.json`));
  const sbom = releaseSbom({
    version,
    electronVersion,
    renderer: { name: ui.name, version: ui.version, inventory: productionInventory(lock) },
    resolved,
    serialNumber: randomUUID(),
    timestamp: new Date().toISOString(),
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(sbom, null, 2)}\n`);
  console.log(`SBOM: ${output}`);
}
if (require.main === module) run();
module.exports = { releaseSbom, swiftComponents };
