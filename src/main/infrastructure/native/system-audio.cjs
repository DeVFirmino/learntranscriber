const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { packetWav } = require('../../domain/audio/wav.cjs');

// The native system-audio capture helper: streams 16 kHz PCM packets of the incoming audio as WAV segments.
class SystemAudio {
  constructor(executable, onChunk, onError, options = {}) {
    this.executable = executable;
    this.onChunk = onChunk;
    this.onError = onError;
    this.spawn = options.spawn || spawn;
    this.execFile = options.execFile || promisify(execFile);
    // Told when the helper exits; `unexpected` when it was running and nobody asked it to stop.
    this.onExit = options.onExit || (() => {});
    // Told when the helper follows a new default output (`reconnecting`, then `device-changed`).
    this.onRoute = options.onRoute || (() => {});
    this.child = null;
    this.sessionId = null;
    this.closed = false;
  }
  async status() {
    const { stdout } = await this.execFile(this.executable, ['--status'], { timeout: 10000, maxBuffer: 10000 });
    return JSON.parse(stdout);
  }
  // Output devices and the default output, read from Core Audio without capturing.
  async listDevices() {
    const { stdout } = await this.execFile(this.executable, ['--list-devices'], { timeout: 10000, maxBuffer: 200000 });
    const value = JSON.parse(stdout);
    if (value.event === 'error')
      throw new Error(String(value.error || 'Audio devices could not be listed.').slice(0, 300));
    if (value.event !== 'devices' || !Array.isArray(value.devices)) throw new Error('Invalid audio device list.');
    return {
      defaultOutputUID: typeof value.defaultOutputUID === 'string' ? value.defaultOutputUID : null,
      devices: value.devices
        .filter((device) => device && typeof device.uid === 'string' && typeof device.name === 'string')
        .slice(0, 64)
        .map((device) => ({
          uid: device.uid.slice(0, 200),
          name: device.name.slice(0, 200),
          isDefault: device.isDefault === true,
          hasInput: device.hasInput === true,
        })),
    };
  }
  async start(sessionId, displayId, live = false, { processTap = false } = {}) {
    if (this.closed) throw new Error('System audio service is closed.');
    if (this.child) throw new Error('Native audio is already starting or running.');
    const child = this.spawn(
      this.executable,
      [
        ...(processTap ? ['--process-tap'] : []),
        ...(live ? ['--live-packets'] : []),
        ...(displayId ? ['--display', String(displayId)] : []),
        '--exclude-bundle',
        'dev.danieldias.learntranscriber',
      ],
      { shell: false, stdio: ['pipe', 'pipe', 'ignore'] },
    );
    this.child = child;
    this.sessionId = sessionId;
    this.stopping = false;
    let buffer = '',
      ready = false;
    let resolveStart, rejectStart;
    const started = new Promise((resolve, reject) => {
      resolveStart = resolve;
      rejectStart = reject;
    });
    const timer = setTimeout(() => {
      rejectStart(
        new Error('Native audio startup timed out. Grant macOS Screen & System Audio Recording permission and retry.'),
      );
      void this.stop();
    }, 30000);
    this.exit = new Promise((resolve) => {
      let ended = false;
      const finish = () => {
        if (ended) return;
        ended = true;
        clearTimeout(timer);
        if (this.child === child) {
          this.child = null;
          this.sessionId = null;
        }
        if (!ready) rejectStart(new Error('Native audio stopped before becoming ready.'));
        else if (!this.stopping) this.onError('Native audio stopped. Listening has ended.');
        this.onExit({ unexpected: ready && !this.stopping });
        resolve();
      };
      child.once('exit', finish);
      child.once('error', finish);
    });
    child.stdout.on('data', (data) => {
      buffer += data.toString('utf8');
      if (buffer.length > 1500000) {
        this.onError('Native audio packet exceeded the buffer limit.');
        void this.stop();
        return;
      }
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        let packet;
        try {
          packet = JSON.parse(line);
        } catch {
          this.onError('Invalid native audio packet.');
          void this.stop();
          return;
        }
        if (packet.event === 'started') {
          ready = true;
          clearTimeout(timer);
          resolveStart(true);
        }
        if (packet.event === 'audio') {
          try {
            const bytes = packetWav(packet.samples);
            this.onChunk({ sessionId, speaker: 'THEY', mime: 'audio/wav', bytes: Uint8Array.from(bytes).buffer });
          } catch (error) {
            this.onError(error.message);
            void this.stop();
          }
        }
        if (packet.event === 'reconnecting') this.onRoute({ event: packet.event, reason: packet.reason });
        if (packet.event === 'device-changed')
          this.onRoute({ event: packet.event, deviceId: packet.deviceId, deviceName: packet.deviceName });
        if (packet.event === 'error') {
          const error = new Error(String(packet.error || 'Native audio failed.').slice(0, 300));
          if (!ready) rejectStart(error);
          else this.onError(error.message);
          void this.stop();
        }
      }
    });
    try {
      return await started;
    } catch (error) {
      await this.stop();
      throw error;
    }
  }
  async stop() {
    const child = this.child;
    if (!child) return;
    this.stopping = true;
    if (child.stdin.writable) child.stdin.write('stop\n');
    let timer;
    await Promise.race([
      this.exit,
      new Promise((resolve) => {
        timer = setTimeout(() => {
          child.kill('SIGTERM');
          resolve();
        }, 2500);
      }),
    ]);
    clearTimeout(timer);
    if (this.child === child) {
      child.kill('SIGKILL');
      await this.exit;
    }
  }
  async close() {
    this.closed = true;
    await this.stop();
  }
}
module.exports = { SystemAudio };
