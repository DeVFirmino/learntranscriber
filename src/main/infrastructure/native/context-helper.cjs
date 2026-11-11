const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const execute = promisify(execFile);

// The native context helper: reads the focused app's selection and recognizes text in screen images.
class NativeContext {
  constructor(executable, executeImpl = execute) {
    this.executable = executable;
    this.execute = executeImpl;
    this.controllers = new Set();
    this.closed = false;
  }
  async invoke(args, signal) {
    if (this.closed) throw new Error('Context service is closed.');
    const controller = new AbortController();
    this.controllers.add(controller);
    try {
      const { stdout } = await this.execute(this.executable, args, {
        signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
        timeout: 15000,
        maxBuffer: 512000,
        encoding: 'utf8',
        env: { PATH: '/usr/bin:/bin', LANG: 'en_US.UTF-8' },
      });
      const result = JSON.parse(stdout);
      if (result.error) throw new Error(result.error);
      return result;
    } catch (error) {
      if (signal?.aborted || controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      let detail;
      try {
        detail = JSON.parse(error.stdout).error;
      } catch {}
      throw new Error(
        detail ||
          (error.code === 'ENOENT'
            ? 'Build the native context helper with npm run native:build.'
            : 'Local text extraction failed. Check the image and macOS permissions.'),
      );
    } finally {
      this.controllers.delete(controller);
    }
  }
  status() {
    return this.invoke(['--status']);
  }
  selection(signal) {
    return this.invoke(['--selection', '--exclude-pid', String(process.pid)], signal);
  }
  async ocr(bytes, signal) {
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 20000000)
      throw new Error('OCR requires an image of at most 20 MB.');
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'learntranscriber-context-'));
    try {
      const file = path.join(directory, 'screen.png');
      await fs.writeFile(file, bytes, { mode: 0o600 });
      return await this.invoke(['--image', file], signal);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
  close() {
    this.closed = true;
    for (const controller of this.controllers) controller.abort();
  }
}
module.exports = { NativeContext };
