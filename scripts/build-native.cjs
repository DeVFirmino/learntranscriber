// Builds the three macOS helpers from the Swift package in native/ as universal (arm64 + x86_64) binaries and places
// them where the app and the packager look for them (.local/native/<name>). Release builds, strict concurrency,
// warnings as errors.
const { spawnSync } = require('node:child_process');
const { mkdirSync, copyFileSync, chmodSync } = require('node:fs');
const path = require('node:path');
if (process.platform !== 'darwin') throw new Error('The native helpers require macOS.');
const packageDirectory = path.resolve('native'),
  output = path.resolve('.local/native'),
  slices = path.resolve('.local/native-slices');
const HELPERS = ['apple-speech', 'system-audio', 'context-helper'];
// The helpers ship to other Macs, so they carry no trace of the machine that built them: source paths are rewritten
// relative to the package and the linker leaves out its debug symbol table, which records the build folder.
const RELEASE_FLAGS = ['-Xswiftc', '-file-prefix-map', '-Xswiftc', `${packageDirectory}=native`, '-Xlinker', '-S'];
// One build per target triple, joined with lipo: `swift build --arch` switches to the Xcode build
// system, which hands `-Xlinker -S` to clang instead of the linker on some Xcode versions.
const ARCHITECTURES = ['arm64', 'x86_64'];
const triple = (arch) => `${arch}-apple-macosx`;

function swift(args, options) {
  const result = spawnSync('swift', args, options);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  return result;
}

// Builds one architecture and copies its helpers out at once, since some toolchains share one products folder.
function buildSlice(arch) {
  const args = [
    'build',
    '-c',
    'release',
    '--package-path',
    packageDirectory,
    '--triple',
    triple(arch),
    ...RELEASE_FLAGS,
  ];
  swift(args, { stdio: 'inherit' });
  const binaries = swift([...args, '--show-bin-path'], { encoding: 'utf8' }).stdout.trim();
  const directory = path.join(slices, arch);
  mkdirSync(directory, { recursive: true });
  for (const name of HELPERS) copyFileSync(path.join(binaries, name), path.join(directory, name));
}

for (const arch of ARCHITECTURES) buildSlice(arch);
mkdirSync(output, { recursive: true });
for (const name of HELPERS) {
  const target = path.join(output, name);
  const lipo = spawnSync('lipo', [
    '-create',
    '-output',
    target,
    ...ARCHITECTURES.map((arch) => path.join(slices, arch, name)),
  ]);
  if (lipo.status !== 0) throw new Error(`Could not join the ${name} architectures: ${lipo.stderr}`);
  chmodSync(target, 0o755);
  console.log(`Built native helper ${name}.`);
}
