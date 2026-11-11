const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
function load(file, imports = {}, globals = {}) {
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env.BASE_URL', JSON.stringify('./')),
    compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
  const module = { exports: {} };
  const scope = {
    module,
    exports: module.exports,
    require: (name) => {
      if (!(name in imports)) throw new Error('Unexpected import: ' + name);
      return imports[name];
    },
    URL,
    DOMException,
    crypto,
    setTimeout,
    clearTimeout,
    ...globals,
  };
  vm.runInNewContext(compiled, scope, { filename: file });
  return module.exports;
}
test('file and remote pages fail closed without a native bridge; loopback preview is explicit', () => {
  for (const url of [
    'file:///Applications/LearnTranscriber.app/index.html',
    'https://example.invalid/',
    'data:text/html,preview',
  ]) {
    let mocks = 0;
    const { createWorkspace } = load(
      'src/bridge/index.ts',
      {
        './mock': {
          createMockWorkspace: () => {
            mocks++;
            return {};
          },
        },
      },
      { window: { location: { href: url } } },
    );
    assert.throws(createWorkspace, /native workspace bridge is unavailable/);
    assert.equal(mocks, 0);
  }
  const api = { state: () => Promise.reject(new Error('native unavailable')) };
  let mocks = 0;
  const native = load(
    'src/bridge/index.ts',
    {
      './mock': {
        createMockWorkspace: () => {
          mocks++;
          return {};
        },
      },
    },
    { window: { location: { href: 'file:///app/index.html' }, workspace: api } },
  ).createWorkspace();
  assert.equal(native.api, api);
  assert.equal(mocks, 0);
  const preview = load(
    'src/bridge/index.ts',
    { './mock': { createMockWorkspace: () => ({ preview: true }) } },
    { window: { location: { href: 'http://127.0.0.1:4173/' } } },
  ).createWorkspace();
  assert.equal(preview.mode, 'mock');
  assert.equal(preview.api.preview, true);
});
function fixture({ start, stop, transcribe } = {}) {
  const captures = [];
  const apiCalls = [],
    texts = [],
    errors = [],
    cancelled = [];
  let stopped = 0;
  class Capture {
    failed = [];
    disposed = false;
    stops = 0;
    constructor(api, notify) {
      this.api = api;
      this.notify = notify;
      captures.push(this);
    }
    async start(id, settings) {
      this.settings = settings;
      this.id = id;
      await start?.(this);
    }
    async stop() {
      this.stops++;
      await stop?.(this);
    }
    dispose() {
      this.disposed = true;
    }
    discardFailed() {
      this.failed = [];
    }
  }
  const api = {
    transcribeMemory: async (input) => {
      apiCalls.push(input);
      return transcribe ? transcribe(input) : 'reviewable dictated text';
    },
    cancel: async (id) => {
      cancelled.push(id);
      return true;
    },
  };
  const { QuestionDictation } = load('src/audio/dictation.ts', { './capture': { AudioCapture: Capture } });
  const dictation = new QuestionDictation(
    api,
    (t) => texts.push(t),
    (e) => errors.push(e),
    () => stopped++,
  );
  return {
    dictation,
    captures,
    apiCalls,
    texts,
    errors,
    cancelled,
    get stopped() {
      return stopped;
    },
  };
}
test('dictation reuses the PCM capture adapter, excludes system audio and returns text only', async () => {
  const f = fixture({
    stop: async (capture) => {
      await capture.api.transcribe({ bytes: new Uint8Array([1, 2]).buffer });
    },
  });
  await f.dictation.start({ systemAudio: true, microphoneId: 'default' });
  assert.equal(f.captures[0].settings.systemAudio, false);
  assert.equal(f.apiCalls.length, 0);
  await f.dictation.stop();
  assert.equal(f.apiCalls[0].mime, 'audio/wav');
  assert.deepEqual(f.texts, ['reviewable dictated text']);
  assert.equal(f.stopped, 1);
  assert.equal(f.captures[0].disposed, true);
});
test('cancel during microphone startup stops the owned capture and discards queued audio', async () => {
  let ready;
  const pending = new Promise((resolve) => {
    ready = resolve;
  });
  const f = fixture({
    start: () => pending,
    stop: async (capture) => {
      try {
        await capture.api.transcribe({ bytes: new ArrayBuffer(4) });
      } catch {}
    },
  });
  const started = f.dictation.start({ systemAudio: true });
  f.dictation.cancel();
  ready();
  await started;
  assert.equal(f.apiCalls.length, 0);
  assert.ok(f.captures[0].stops > 0);
  assert.equal(f.captures[0].disposed, true);
  assert.equal(f.texts.length, 0);
});
test('cancel aborts an in-flight transcript and ignores its late result', async () => {
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const f = fixture({
    transcribe: () => pending,
    stop: async (capture) => {
      await capture.api.transcribe({ bytes: new ArrayBuffer(4) });
    },
  });
  await f.dictation.start({ systemAudio: false });
  const stopped = f.dictation.stop();
  assert.equal(f.apiCalls.length, 1);
  f.dictation.cancel();
  assert.equal(f.cancelled[0], f.apiCalls[0].requestId);
  finish('late text');
  await stopped;
  assert.equal(f.texts.length, 0);
});
test('microphone failure releases state and permits a later attempt', async () => {
  let calls = 0;
  const f = fixture({
    start: async () => {
      if (calls++ === 0) throw new Error('Microphone permission denied.');
    },
  });
  await assert.rejects(f.dictation.start({ systemAudio: false }), /permission denied/);
  assert.equal(f.stopped, 1);
  assert.equal(f.captures[0].disposed, true);
  await f.dictation.start({ systemAudio: false });
  await f.dictation.stop();
  assert.equal(f.stopped, 2);
});

const pcm = load('src/audio/pcm.ts');
const { encodeWav } = pcm;
test('PCM output is a standalone little-endian mono WAV with the exact sample sequence', () => {
  const output = encodeWav([new Int16Array([-32768, 0]), new Int16Array([32767, 100])], 16000);
  const bytes = Buffer.from(output.buffer),
    view = new DataView(output.buffer);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(40, true), 8);
  assert.equal(view.getInt16(44, true), -32768);
  assert.equal(view.getInt16(48, true), 32767);
  assert.equal(output.peak, 32768);
  assert.equal(encodeWav([new Int16Array(2048)], 16000).peak, 0);
});

test('cancelling microphone startup releases a stream that arrives after cancellation', async () => {
  let givePermission,
    stopped = false;
  const stream = {
    getTracks: () => [
      {
        stop: () => {
          stopped = true;
        },
      },
    ],
  };
  const sandbox = {
    window: {},
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
    crypto,
    AudioContext: class {
      constructor() {
        this.state = 'running';
        this.audioWorklet = { addModule: async () => {} };
      }
      async resume() {}
      async close() {
        this.state = 'closed';
      }
    },
    navigator: {
      mediaDevices: {
        getUserMedia: () =>
          new Promise((resolve) => {
            givePermission = resolve;
          }),
      },
    },
  };
  // The capture's own modules are the real ones, in the same browser fakes.
  // Loaded after the modules they import.
  const imports = { './pcm': pcm };
  for (const name of [
    'capture-settings',
    'incoming-streams',
    'live-captions',
    'native-system-audio',
    'recording-echo',
    'segment-delivery',
    'worklet-input',
    'recording-sources',
    'incoming-source',
    'level-meter',
    'recording-pipeline',
  ])
    imports['./' + name] = load('src/audio/' + name + '.ts', imports, sandbox);
  const { AudioCapture } = load('src/audio/capture.ts', imports, sandbox);
  const capture = new AudioCapture({}, () => {});
  const starting = capture.start('session', { microphoneId: 'default', systemAudio: false }).catch(() => {});
  while (!givePermission) await new Promise((resolve) => setImmediate(resolve));
  await capture.stop();
  givePermission(stream);
  await starting;
  assert.equal(stopped, true);
});
