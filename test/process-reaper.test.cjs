const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { reapOrphans } = require('../src/main/infrastructure/local/process-reaper.cjs');

// A fake `ps`: resolves with the command line for a pid that is "alive" in this test, rejects (as the real
// `ps -p <pid>` does for an unknown pid) otherwise.
function fakePs(commands) {
  return async (file, args) => {
    assert.equal(file, 'ps');
    assert.deepEqual(args.slice(0, 2), ['-o', 'command=']);
    const pid = Number(args[3]);
    if (!Object.hasOwn(commands, pid)) throw new Error(`ps: ${pid}: No such process`);
    return { stdout: commands[pid] };
  };
}

async function registry(t, entries) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lt-process-reaper-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'running.json');
  if (entries !== undefined) await fs.writeFile(file, JSON.stringify(entries));
  return file;
}

test('an alive pid whose command still matches is sent SIGTERM, then SIGKILL if it outlives the delay', async (t) => {
  const file = await registry(t, { llm: { pid: 111, executable: '/opt/homebrew/bin/llama-server', port: 8080 } });
  const killed = [];
  const delays = [];
  await reapOrphans({
    file,
    execFile: fakePs({ 111: '/opt/homebrew/bin/llama-server -m model.gguf' }),
    kill: (pid, signal) => killed.push([pid, signal]),
    delay: async (ms) => delays.push(ms),
  });
  assert.deepEqual(killed, [
    [111, 'SIGTERM'],
    [111, 'SIGKILL'],
  ]);
  assert.deepEqual(delays, [2000]);
  await assert.rejects(fs.access(file), { code: 'ENOENT' }, 'the registry is cleared once reaping finishes');
});

test('an alive pid that stopped itself during the delay is not sent SIGKILL', async (t) => {
  const commands = { 222: '/opt/homebrew/bin/whisper-server' };
  const file = await registry(t, { whisper: { pid: 222, executable: '/opt/homebrew/bin/whisper-server', port: 9090 } });
  const killed = [];
  await reapOrphans({
    file,
    execFile: fakePs(commands),
    kill: (pid, signal) => killed.push([pid, signal]),
    delay: async () => {
      delete commands[222]; // the process exited on its own once asked, before the SIGKILL check runs
    },
  });
  assert.deepEqual(killed, [[222, 'SIGTERM']]);
});

test('a pid alive but running a different command is left alone, and its entry is still cleared', async (t) => {
  const file = await registry(t, { llm: { pid: 333, executable: '/opt/homebrew/bin/llama-server', port: 8080 } });
  const killed = [];
  await reapOrphans({
    file,
    execFile: fakePs({ 333: '/usr/bin/some-other-program --port 8080' }),
    kill: (pid, signal) => killed.push([pid, signal]),
    delay: async () => {
      throw new Error('should not wait for a pid that was left alone');
    },
  });
  assert.deepEqual(killed, []);
  await assert.rejects(fs.access(file), { code: 'ENOENT' });
});

test('a dead pid is just dropped, with no kill and no wait', async (t) => {
  const file = await registry(t, { llm: { pid: 444, executable: '/opt/homebrew/bin/llama-server', port: 8080 } });
  const killed = [];
  await reapOrphans({
    file,
    execFile: fakePs({}),
    kill: (pid, signal) => killed.push([pid, signal]),
    delay: async () => {
      throw new Error('should not wait for a pid that was already dead');
    },
  });
  assert.deepEqual(killed, []);
});

test('a missing or corrupt registry file is treated as empty, and a kill error for one entry does not stop another', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lt-process-reaper-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await assert.doesNotReject(
    reapOrphans({
      file: path.join(directory, 'missing.json'),
      execFile: fakePs({}),
      kill: () => {
        throw new Error('should never be called');
      },
      delay: async () => {},
    }),
  );
  const corrupt = path.join(directory, 'corrupt.json');
  await fs.writeFile(corrupt, 'not json');
  await assert.doesNotReject(
    reapOrphans({ file: corrupt, execFile: fakePs({}), kill: () => {}, delay: async () => {} }),
  );
  await assert.rejects(fs.access(corrupt), { code: 'ENOENT' }, 'a corrupt file is cleared, not left behind');
  const both = await registry(t, {
    llm: { pid: 1, executable: '/opt/homebrew/bin/llama-server', port: 1 },
    whisper: { pid: 2, executable: '/opt/homebrew/bin/whisper-server', port: 2 },
  });
  const killed = [];
  await reapOrphans({
    file: both,
    execFile: fakePs({ 1: '/opt/homebrew/bin/llama-server', 2: '/opt/homebrew/bin/whisper-server' }),
    kill: (pid, signal) => {
      killed.push([pid, signal]);
      if (pid === 1) throw new Error('SIGTERM refused for pid 1');
    },
    delay: async () => {},
  });
  assert.ok(
    killed.some(([pid]) => pid === 2),
    'the second entry is still reaped despite the first kill failing',
  );
});
