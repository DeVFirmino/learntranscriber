const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const executable = process.argv[2] || require('electron');
const output = path.resolve('.local/native-smoke');
fs.mkdirSync(output, { recursive: true });
fs.rmSync(path.join(output, 'result.json'), { force: true });
const packaged = Boolean(process.argv[2]);
const env = {
  ...process.env,
  LEARNTRANSCRIBER_SMOKE_OUTPUT: output,
  LEARNTRANSCRIBER_SMOKE_PROBE: path.resolve(__dirname, 'capture-protection-probe.swift'),
  // The local runtime fixture runs on this Node. A packaged app refuses to run as Node (its runAsNode fuse is off), so
  // spawning the app itself would open a real, non-smoke instance on the user's profile.
  LEARNTRANSCRIBER_SMOKE_NODE: process.execPath,
};
delete env.ELECTRON_RUN_AS_NODE;
// Each run starts with a fresh smoke Keychain item, so a new Electron binary creates it instead of asking for access
// to one an older binary created.
if (process.platform === 'darwin')
  for (let attempt = 0; attempt < 5; attempt += 1)
    if (
      spawnSync('security', ['delete-generic-password', '-s', 'LearnTranscriber Smoke Safe Storage'], {
        stdio: 'ignore',
      }).status !== 0
    )
      break;
const child = spawn(executable, [...(packaged ? [] : ['.']), '--smoke-test'], { stdio: 'inherit', env });
let timedOut = false;
const timeout = setTimeout(() => {
  timedOut = true;
  console.error('Native smoke timed out.');
  child.kill('SIGTERM');
  process.exitCode = 1;
}, 240000);
child.on('error', (error) => {
  clearTimeout(timeout);
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  clearTimeout(timeout);
  if (timedOut) {
    process.exitCode = 1;
    return;
  }
  if (code !== 0) {
    process.exitCode = code || 1;
    return;
  }
  const result = JSON.parse(fs.readFileSync(path.join(output, 'result.json'), 'utf8'));
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
});
