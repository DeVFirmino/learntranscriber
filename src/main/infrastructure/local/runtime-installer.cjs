const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const FORMULAS = {
  llm: { formula: 'llama.cpp', binary: 'llama-server' },
  whisper: { formula: 'whisper-cpp', binary: 'whisper-server' },
};
// Terminal color codes in Homebrew's output (ESC [ … m), removed before the progress text is shown.
const ANSI_COLOR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

// Installs the llama.cpp or whisper.cpp server with Homebrew and points the local models at its executable.
class RuntimeInstaller {
  constructor(models, onChange = () => {}, options = {}) {
    this.models = models;
    this.onChange = onChange;
    this.spawn = options.spawn || spawn;
    this.execute = options.execute || promisify(execFile);
    this.paths = options.paths || ['/opt/homebrew/bin/brew', '/usr/local/bin/brew'];
    this.pending = new Map();
    this.closed = false;
  }
  async brew() {
    for (const file of this.paths)
      try {
        await fs.access(file, 0o1);
        return file;
      } catch {}
    throw new Error(
      'Homebrew is required for automatic runtime installation. Install it from brew.sh, or choose an existing server executable.',
    );
  }
  state() {
    return [...this.pending].map(([kind, p]) => ({ kind, status: p.status, progress: p.progress }));
  }
  emit() {
    this.onChange(this.state());
  }
  async install(kind) {
    const spec = FORMULAS[kind];
    if (!spec) throw new Error('Choose an LLM or Whisper runtime.');
    if (this.closed) throw new Error('Runtime installer is closed.');
    if (this.pending.size) throw new Error('Wait for the current runtime installation.');
    if (this.models.state().runtimes[kind].status !== 'stopped')
      throw new Error('Stop the server before installing its runtime.');
    const brew = await this.brew(),
      operation = { status: 'installing', progress: 'Starting Homebrew installation…' };
    this.pending.set(kind, operation);
    this.emit();
    const env = {
      PATH: path.dirname(brew) + ':/usr/bin:/bin:/usr/sbin:/sbin',
      HOME: process.env.HOME,
      LANG: 'en_US.UTF-8',
      HOMEBREW_NO_AUTO_UPDATE: '1',
      HOMEBREW_NO_INSTALL_CLEANUP: '1',
      HOMEBREW_NO_ANALYTICS: '1',
    };
    try {
      await new Promise((resolve, reject) => {
        const child = this.spawn(brew, ['install', spec.formula], {
          shell: false,
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env,
        });
        operation.child = child;
        let tail = '';
        const progress = (data) => {
          tail = (tail + data.toString()).slice(-2000);
          operation.progress = tail
            .replace(ANSI_COLOR, '')
            .split(/[\r\n]/)
            .filter(Boolean)
            .slice(-2)
            .join(' · ')
            .slice(-350);
          this.emit();
        };
        child.stdout?.on('data', progress);
        child.stderr?.on('data', progress);
        operation.cancel = () => {
          operation.cancelled = true;
          try {
            process.kill(-child.pid, 'SIGTERM');
          } catch {
            child.kill('SIGTERM');
          }
        };
        child.once('error', () => reject(new Error('Homebrew could not start.')));
        child.once('exit', (code) =>
          code === 0 && !operation.cancelled
            ? resolve()
            : reject(
                new Error(
                  operation.cancelled
                    ? 'Runtime installation cancelled.'
                    : 'Homebrew installation failed. Check the Homebrew setup and try again.',
                ),
              ),
        );
      });
      if (this.closed || operation.cancelled) throw new Error('Runtime installation cancelled.');
      const { stdout } = await this.execute(brew, ['--prefix', spec.formula], {
        env,
        timeout: 10000,
        maxBuffer: 10000,
      });
      await this.models.setBinary(kind, path.join(stdout.trim(), 'bin', spec.binary));
      return this.models.state();
    } finally {
      this.pending.delete(kind);
      this.emit();
    }
  }
  cancel(kind) {
    this.pending.get(kind)?.cancel?.();
  }
  close() {
    this.closed = true;
    for (const kind of this.pending.keys()) this.cancel(kind);
  }
}
module.exports = { RuntimeInstaller };
