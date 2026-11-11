const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  vm = require('node:vm'),
  ts = require('typescript');
function load(file, context) {
  const source = ts.transpileModule(
    fs.readFileSync(file, 'utf8').replaceAll('import.meta.env.BASE_URL', JSON.stringify('./')),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const moduleValue = { exports: {} };
  vm.runInNewContext(source, {
    ...context,
    module: moduleValue,
    exports: moduleValue.exports,
    require: (name) => (name.startsWith('./') ? load('src/audio/' + name.slice(2) + '.ts', context) : {}),
  });
  return moduleValue.exports;
}
const context = {
  window: { setTimeout: (fn) => setTimeout(fn, 1), clearTimeout, clearInterval },
  crypto,
  setTimeout,
  clearTimeout,
  Promise,
  Error,
};

function stuckInput() {
  const disconnected = { value: 0 };
  return {
    disconnected,
    input: {
      speaker: 'ME',
      chunks: [new Int16Array(4000).fill(1000)],
      acks: new Map(),
      timer: 0,
      flushPromise: Promise.resolve(),
      node: {
        port: { postMessage() {}, close() {} },
        disconnect() {
          disconnected.value++;
        },
      },
      source: { disconnect() {} },
      sink: { disconnect() {} },
      owner: { getTracks: () => [] },
    },
  };
}

test('an unresponsive audio processor fails the stop and keeps received audio for retry', async () => {
  const { AudioCapture } = load('src/audio/capture.ts', context);
  const messages = [],
    capture = new AudioCapture({ transcribe: async () => true }, (message) => {
      if (message) messages.push(message);
    });
  const { input } = stuckInput();
  Object.assign(capture.pipeline.sources, {
    inputs: [input],
    context: { sampleRate: 16000, state: 'running', close: async () => {} },
  });
  Object.assign(capture, {
    recording: true,
    sessionId: 's1',
  });
  await assert.rejects(capture.stop(), /stopped responding/);
  assert.equal(capture.failed.length, 1);
  assert.equal(capture.failed[0].sessionId, 's1');
  assert.equal(capture.failed[0].speaker, 'ME');
  assert.ok(capture.failed[0].bytes.byteLength > 44);
  assert.equal(capture.stopping, false);
  assert.equal(capture.recording, false);
  assert.ok(messages.some((message) => /stopped responding/.test(message)));
});

test('a live frame the main process refuses fails the stop and is kept for retry', async () => {
  const { AudioCapture } = load('src/audio/capture.ts', context);
  const messages = [];
  let stopped = 0;
  const capture = new AudioCapture(
    {
      transcribe: async () => true,
      pushLiveAudio: async () => {
        throw new Error('Apple Speech is busy.');
      },
      stopLiveTranscription: async () => {
        stopped++;
        return true;
      },
    },
    (message) => {
      if (message) messages.push(message);
    },
  );
  capture.pipeline.live.active = true;
  capture.pipeline.sources.context = { sampleRate: 16000, state: 'running', close: async () => {} };
  Object.assign(capture, {
    recording: false,
    sessionId: 's1',
  });
  capture.pipeline.delivery.live(new Int16Array(16000).fill(500), 'ME', 's1');
  await assert.rejects(capture.stop(), /Apple Speech is busy/);
  assert.equal(stopped, 1, 'the live session still stops');
  assert.equal(capture.failed.length, 1);
  assert.equal(capture.failed[0].sessionId, 's1');
  assert.equal(capture.failed[0].mime, 'audio/wav');
  assert.ok(capture.failed[0].bytes.byteLength > 44);
  await capture.stop();
});

test('constructing a capture subscribes to nothing; connect, dispose and reconnect keep exactly one set', () => {
  const { AudioCapture } = load('src/audio/capture.ts', context);
  const live = new Set(),
    subscribe = (listener) => {
      live.add(listener);
      return () => live.delete(listener);
    };
  const capture = new AudioCapture(
    { transcribe: async () => true, onSystemAudio: subscribe, onLiveCaption: subscribe, onSystemAudioError: subscribe },
    () => {},
  );
  assert.equal(live.size, 0, 'an abandoned render leaks no listeners');
  capture.connect();
  capture.connect();
  assert.equal(live.size, 3);
  capture.dispose();
  assert.equal(live.size, 0);
  capture.connect();
  assert.equal(live.size, 3, 'a StrictMode setup after cleanup restores the listeners');
});
