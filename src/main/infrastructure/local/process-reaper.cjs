const fsp = require('node:fs/promises');
const { commandMatchesExecutable } = require('../../domain/providers/process-reap.cjs');

// What `pid` is running right now, or '' once it is gone; ps itself fails once the pid no longer exists.
async function commandFor(execFile, pid) {
  try {
    const { stdout } = await execFile('ps', ['-o', 'command=', '-p', String(pid)]);
    return stdout.trim();
  } catch {
    return '';
  }
}

/**
 * Reaps a managed server left running by a crash or a force quit, before this app instance starts one of its
 * own: an entry whose pid is already gone is dropped, one whose pid now runs a different command is left alone
 * (the OS can reuse a pid once the process that held it exits), and a match is asked to exit and killed after
 * `delay(2000)` if it has not by then. The registry file is cleared afterward either way, including when it was
 * missing or unreadable.
 */
async function reapOrphans({ file, execFile, kill, delay }) {
  let entries;
  try {
    entries = JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    entries = {};
  }
  const safeKill = (pid, signal) => {
    try {
      kill(pid, signal);
    } catch {}
  };
  await Promise.all(
    Object.values(entries && typeof entries === 'object' ? entries : {}).map(async (entry) => {
      const pid = entry?.pid,
        executable = entry?.executable;
      if (!Number.isInteger(pid) || typeof executable !== 'string') return;
      const command = await commandFor(execFile, pid);
      if (!commandMatchesExecutable(command, executable)) return;
      safeKill(pid, 'SIGTERM');
      await delay(2000);
      if (await commandFor(execFile, pid)) safeKill(pid, 'SIGKILL');
    }),
  );
  await fsp.rm(file, { force: true });
}

module.exports = { reapOrphans };
