const { test } = require('node:test');
const assert = require('node:assert/strict');
const { captureVersion } = require('../src/main/infrastructure/local/runtime-version.cjs');

test('a successful run is parsed, passes no shell and a reduced environment, and respects the timeout', async () => {
  process.env.LT_RUNTIME_VERSION_TEST_SECRET = 'should-not-leak';
  let call;
  const version = await captureVersion({
    execFile: async (file, args, options) => {
      call = { file, args, options };
      return { stdout: '', stderr: 'version: 0.7.0 (build 11669, commit 620d2225c)\n' };
    },
    binary: '/opt/homebrew/bin/llama-server',
    timeoutMs: 1234,
  });
  delete process.env.LT_RUNTIME_VERSION_TEST_SECRET;
  assert.equal(version, '0.7.0 (build 11669, commit 620d2225c)');
  assert.equal(call.file, '/opt/homebrew/bin/llama-server');
  assert.deepEqual(call.args, ['--version']);
  assert.equal(call.options.timeout, 1234);
  assert.equal(call.options.shell, undefined, 'execFile is never asked to use a shell');
  assert.equal(call.options.env.LT_RUNTIME_VERSION_TEST_SECRET, undefined, 'the environment is reduced');
});

test('output with no recognisable version line is unknown, even on a clean exit', async () => {
  const version = await captureVersion({
    execFile: async () => ({ stdout: '', stderr: 'load_backend: loaded BLAS backend\nerror: unknown argument\n' }),
    binary: '/opt/homebrew/bin/whisper-server',
  });
  assert.equal(version, 'unknown');
});

test('a missing executable, a timeout or any other rejection is unknown rather than a thrown error', async () => {
  for (const failure of [
    Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }),
    Object.assign(new Error('timed out'), { killed: true, signal: 'SIGTERM' }),
  ]) {
    const version = await captureVersion({
      execFile: async () => {
        throw failure;
      },
      binary: '/missing/binary',
    });
    assert.equal(version, 'unknown');
  }
});
