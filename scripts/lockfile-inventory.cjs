// The packages an npm lockfile installs for a project's production dependencies, as CycloneDX components and
// dependency edges. It starts at the root's dependencies and follows each package's dependencies and peers, resolving
// a name the way Node does: the node_modules folder beside the dependent first, then each one above it. Two kinds are
// left out on purpose: optional dependencies, which in ui/ are only the native canvas binaries pdfjs-dist uses under
// Node and never in the browser, and @types packages, which hold type declarations the build erases. A peer that only
// a development tool installed is not followed either.
const HASHES = { sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };
const MARKER = 'node_modules/';

const nameOf = (key) => key.slice(key.lastIndexOf(MARKER) + MARKER.length);

// The lockfile entry Node would load for `name` when it is required from the package at `from` ('' is the root).
function resolve(packages, from, name) {
  for (let base = from; ;) {
    const key = `${base ? `${base}/` : ''}${MARKER}${name}`;
    if (packages[key]) return key;
    if (!base) return null;
    const parent = base.lastIndexOf(`/${MARKER}`);
    base = parent === -1 ? '' : base.slice(0, parent);
  }
}

function purl(name, version) {
  const scoped = name.startsWith('@') ? `%40${name.slice(1)}` : name;
  return `pkg:npm/${scoped}@${version}`;
}

function component(name, entry) {
  const [algorithm, digest] = (entry.integrity || '').split(' ')[0].split('-');
  return {
    'bom-ref': `${name}@${entry.version}`,
    type: 'library',
    name,
    version: entry.version,
    purl: purl(name, entry.version),
    ...(HASHES[algorithm] && {
      hashes: [{ alg: HASHES[algorithm], content: Buffer.from(digest, 'base64').toString('hex') }],
    }),
    ...(entry.license && { licenses: [{ expression: entry.license }] }),
    ...(entry.resolved && { externalReferences: [{ type: 'distribution', url: entry.resolved }] }),
  };
}

function productionInventory(lock) {
  const { packages } = lock;
  const edges = new Map();
  const queue = [''];
  const queued = new Set(queue);
  for (let index = 0; index < queue.length; index++) {
    const from = queue[index];
    const entry = packages[from];
    const wanted = [
      ...Object.keys(entry.dependencies || {}).map((name) => [name, false]),
      ...Object.keys(entry.peerDependencies || {}).map((name) => [name, true]),
    ];
    const targets = [];
    for (const [name, peer] of wanted) {
      if (name.startsWith('@types/')) continue;
      const key = resolve(packages, from, name);
      if (!key || (peer && packages[key].dev)) continue;
      targets.push(key);
      if (!queued.has(key)) {
        queued.add(key);
        queue.push(key);
      }
    }
    edges.set(from, targets);
  }
  const ref = (key) => `${nameOf(key)}@${packages[key].version}`;
  const components = new Map();
  const dependsOn = new Map();
  for (const [key, targets] of edges) {
    if (!key) continue;
    components.set(ref(key), component(nameOf(key), packages[key]));
    const refs = dependsOn.get(ref(key)) || new Set();
    for (const target of targets) refs.add(ref(target));
    dependsOn.set(ref(key), refs);
  }
  return {
    dependsOn: [...new Set(edges.get('').map(ref))],
    components: [...components.values()],
    dependencies: [...dependsOn].map(([key, refs]) => ({ ref: key, dependsOn: [...refs] })),
  };
}

module.exports = { productionInventory, resolve };
