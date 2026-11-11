const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { normalizeLocale, normalizeUsage, replacementLocale } = require('../../domain/audio/apple-locale-capacity.cjs');
const execute = promisify(execFile);

// The Apple Speech helper: transcribes WAV segments one at a time and installs or releases on-device languages
// within the system's language capacity.
class NativeSpeech {
  constructor(executable, executeImpl = execute, options = {}) {
    this.executable = executable;
    this.execute = executeImpl;
    this.queue = Promise.resolve();
    this.controllers = new Set();
    this.closed = false;
    this.assetController = null;
    this.assetOperations = new Map();
    let usage = {};
    this.usage = options.usage || {
      read: () => usage,
      write: (value) => {
        usage = value;
      },
    };
    this.now = options.now || Date.now;
  }
  async invoke(args, signal) {
    let stdout;
    try {
      ({ stdout } = await this.execute(this.executable, args, {
        signal,
        timeout: args.includes('--install-locale') ? 600000 : 65000,
        maxBuffer: 1024 * 1024,
        encoding: 'utf8',
        env: { PATH: '/usr/bin:/bin', LANG: 'en_US.UTF-8' },
      }));
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (error.code === 'ENOENT') throw new Error('Apple Speech helper is not built. Run npm run native:build.');
      let response;
      try {
        response = JSON.parse(error.stdout);
      } catch {}
      throw new Error(response?.error || 'Apple Speech could not process the audio segment.');
    }
    const result = JSON.parse(stdout);
    if (result.error) throw new Error(result.error);
    return result;
  }
  assets() {
    return this.invoke(['--list-assets'], AbortSignal.timeout(15000));
  }
  manageLocale(operation, locale, { preserveExisting = false } = {}) {
    if (
      !['install', 'release'].includes(operation) ||
      typeof locale !== 'string' ||
      !locale.trim() ||
      locale.length > 80
    )
      throw new Error('Choose a valid Apple Speech language operation.');
    if (this.closed) throw new Error('The speech service is closed.');
    const key = `${operation}:${normalizeLocale(locale)}`;
    const pending = this.assetOperations.get(key);
    if (pending) {
      if (pending.preserveExisting !== preserveExisting)
        throw new Error('Apple Speech is already preparing this language with a different capacity policy.');
      return pending.promise;
    }
    const controller = new AbortController();
    const action = async () => {
      controller.signal.throwIfAborted();
      if (this.closed) throw new Error('The speech service is closed.');
      this.assetController = controller;
      let replacedLocale = null;
      try {
        if (operation === 'install') {
          const assets = await this.invoke(['--list-assets'], controller.signal);
          controller.signal.throwIfAborted();
          const candidate = replacementLocale(assets, locale, this.usage.read());
          if (candidate) {
            if (preserveExisting) {
              const error = new Error(
                'Apple Speech language capacity is full. Existing language reservations were kept.',
              );
              error.code = 'apple-speech-locale-capacity';
              throw error;
            }
            const released = await this.invoke(['--release-locale', '--locale', candidate], controller.signal);
            if (!released.released) throw new Error(`Unable to release ${candidate} for the Apple Speech download.`);
            replacedLocale = released.locale || candidate;
            this.forgetLocaleUsage(replacedLocale);
            controller.signal.throwIfAborted();
          }
        }
        const result = await this.invoke(
          [operation === 'install' ? '--install-locale' : '--release-locale', '--locale', locale],
          controller.signal,
        );
        if (operation === 'install' && result.assetStatus === 'installed')
          this.recordLocaleUsage(result.locale || locale);
        else if (result.released) this.forgetLocaleUsage(result.locale || locale);
        return { ...result, replacedLocale };
      } catch (error) {
        if (replacedLocale) error.replacedLocale = replacedLocale;
        throw error;
      } finally {
        if (this.assetController === controller) this.assetController = null;
      }
    };
    const promise = this.queue.then(action).finally(() => {
      if (this.assetOperations.get(key)?.controller === controller) this.assetOperations.delete(key);
    });
    this.queue = promise.catch(() => {});
    this.assetOperations.set(key, { controller, promise, preserveExisting });
    return promise;
  }
  recordLocaleUsage(locale) {
    const normalized = normalizeLocale(locale);
    if (normalized) this.usage.write({ ...normalizeUsage(this.usage.read()), [normalized]: this.now() });
  }
  forgetLocaleUsage(locale) {
    const usage = normalizeUsage(this.usage.read());
    delete usage[normalizeLocale(locale)];
    this.usage.write(usage);
  }
  cancelAssetOperation() {
    for (const operation of this.assetOperations.values()) operation.controller.abort();
  }
  capabilities(locale) {
    return this.invoke(['--capabilities', '--locale', locale], AbortSignal.timeout(10000));
  }
  transcribe(bytes, locale, signal) {
    const action = async () => {
      if (this.closed) throw new Error('The speech service is closed.');
      signal?.throwIfAborted();
      const controller = new AbortController();
      this.controllers.add(controller);
      const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
      let directory;
      try {
        directory = await fs.mkdtemp(path.join(tmpdir(), 'learntranscriber-audio-'));
        const audioPath = path.join(directory, 'segment.wav');
        await fs.writeFile(audioPath, bytes, { mode: 0o600 });
        const result = await this.invoke(['--audio', audioPath, '--locale', locale], combined);
        if (typeof result.text !== 'string') throw new Error('Apple Speech returned no transcript.');
        this.recordLocaleUsage(result.locale || locale);
        return result.text.trim();
      } finally {
        this.controllers.delete(controller);
        if (directory) await fs.rm(directory, { recursive: true, force: true });
      }
    };
    const pending = this.queue.then(action);
    this.queue = pending.catch(() => {});
    return pending;
  }
  close() {
    this.closed = true;
    this.cancelAssetOperation();
    for (const controller of this.controllers) controller.abort();
  }
}
module.exports = { NativeSpeech };
