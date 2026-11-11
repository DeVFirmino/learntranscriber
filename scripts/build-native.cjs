// Builds the three macOS helpers from the Swift package in native/ and places them where the app and
// the packager look for them (.local/native/<name>). Release builds, strict concurrency, warnings as errors.
const { spawnSync } = require('node:child_process');
const { mkdirSync, copyFileSync, chmodSync } = require('node:fs');
const path = require('node:path');
if (process.platform !== 'darwin') throw new Error('The native helpers require macOS.');
const packageDirectory = path.resolve('native'),
  output = path.resolve('.local/native');
const HELPERS = ['apple-speech', 'system-audio', 'context-helper'];
const build = spawnSync('swift', ['build', '-c', 'release', '--package-path', packageDirectory], { stdio: 'inherit' });
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status || 1);
const binaries = spawnSync('swift', ['build', '-c', 'release', '--package-path', packageDirectory, '--show-bin-path'], {
  encoding: 'utf8',
});
if (binaries.status !== 0) process.exit(binaries.status || 1);
mkdirSync(output, { recursive: true });
for (const name of HELPERS) {
  const target = path.join(output, name);
  copyFileSync(path.join(binaries.stdout.trim(), name), target);
  chmodSync(target, 0o755);
  console.log(`Built native helper ${name}.`);
}
