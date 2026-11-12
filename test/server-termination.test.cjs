// Stopping a local server asks it to exit first and kills it only when it ignores that, so a stuck llama-server or
// whisper-server never outlives the app.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { spawnServer, terminateServer } = require('../src/main/infrastructure/local/server-process.cjs');

// Starts a real Node child that writes "ready" to stderr once its SIGTERM behaviour is in place.
async function startServer(script) {
  const runtime = { status: 'ready' };
  const signals = [];
  const tracked = (binary, args, options) => {
    const child = spawn(binary, args, options);
    const kill = child.kill.bind(child);
    child.kill = (signal) => {
      signals.push(signal);
      return kill(signal);
    };
    return child;
  };
  spawnServer({ spawn: tracked, binary: process.execPath, args: ['-e', script], runtime, onExit: () => {} });
  while (!runtime.stderr.includes('ready')) await once(runtime.child.stderr, 'data');
  return { runtime, signals };
}

test('a server that exits when asked is never killed', async () => {
  const { runtime, signals } = await startServer("process.stderr.write('ready'); setInterval(() => {}, 1000)");
  await terminateServer(runtime);
  assert.deepEqual(signals, ['SIGTERM']);
  assert.equal(runtime.child, null);
  assert.equal(runtime.status, 'stopped');
});

test('a server that ignores SIGTERM is killed after the grace period', async () => {
  const { runtime, signals } = await startServer(
    "process.on('SIGTERM', () => {}); process.stderr.write('ready'); setInterval(() => {}, 1000)",
  );
  const started = Date.now();
  await terminateServer(runtime);
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  assert.ok(Date.now() - started >= 1900, 'waits about two seconds before killing');
  assert.equal(runtime.child, null);
  assert.equal(runtime.status, 'stopped');
});
