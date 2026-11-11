// The recording path takes a lease on the shared native capture for the helper routes and records a chosen loopback
// input itself. Browser audio objects are fakes; nothing is recorded.
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

function browser({ failInput } = {}) {
  const requested = [];
  const nodes = [];
  const stopped = [];
  const node = () => ({ connect() {}, disconnect() {} });
  const stream = (name) => {
    const track = { stop: () => stopped.push(name), addEventListener() {}, removeEventListener() {} };
    return { getTracks: () => [track], getAudioTracks: () => [track] };
  };
  class AudioContext {
    sampleRate = 16000;
    state = 'running';
    destination = {};
    audioWorklet = { addModule: async () => {} };
    async resume() {}
    async close() {
      this.state = 'closed';
    }
    createMediaStreamSource = node;
    createGain = () => ({ ...node(), gain: { value: 1 } });
  }
  class AudioWorkletNode {
    constructor() {
      nodes.push(this);
    }
    // Acknowledges every flush, as the PCM worklet does.
    port = {
      onmessage: null,
      postMessage(message) {
        if (message.type === 'flush')
          Promise.resolve().then(() => this.onmessage?.({ data: { type: 'flushed', id: message.id } }));
      },
      close() {},
    };
    connect() {}
    disconnect() {}
  }
  return {
    requested,
    nodes,
    stopped,
    context: {
      AudioContext,
      AudioWorkletNode,
      MediaStream: class {},
      navigator: {
        mediaDevices: {
          getUserMedia: async (constraints) => {
            requested.push(constraints.audio);
            const id = constraints.audio.deviceId?.exact;
            if (failInput && id === failInput) throw new Error('Requested device not found');
            return stream(id || 'microphone');
          },
        },
      },
      window: { setInterval: () => 1, clearInterval() {}, setTimeout: (fn) => setTimeout(fn, 1), clearTimeout },
      crypto,
      setTimeout,
      clearTimeout,
      Promise,
      Error,
    },
  };
}

const settings = (source, extra = {}) => ({
  microphoneId: 'default',
  systemAudio: true,
  systemAudioSource: source,
  systemAudioInputDevice: '',
  ...extra,
});

test('the helper routes hold a lease for the recording and release it when it stops', async () => {
  const { context } = browser();
  const { AudioCapture } = load('src/audio/capture.ts', context);
  const calls = [],
    messages = [];
  const capture = new AudioCapture(
    {
      transcribe: async () => true,
      acquireSystemAudio: async (lease, id) => {
        calls.push(['acquire', lease, id]);
        return { route: 'native', fellBack: true, reason: 'The process tap source requires macOS 14.2 or later.' };
      },
      releaseSystemAudio: async (lease) => calls.push(['release', lease]),
      startSystemAudio: async () => calls.push(['legacy start']),
    },
    (message) => message && messages.push(message),
  );
  await capture.start('s1', settings('process-tap'));
  await capture.stop();
  assert.deepEqual(calls, [
    ['acquire', 'capture-1', 's1'],
    ['release', 'capture-1'],
  ]);
  assert.ok(
    messages.some((message) => /uses ScreenCaptureKit\. The process tap source requires macOS 14\.2/.test(message)),
  );
});

test('a cancelled start still releases its lease', async () => {
  const { context } = browser();
  const { AudioCapture } = load('src/audio/capture.ts', context);
  const calls = [];
  const capture = new AudioCapture(
    {
      transcribe: async () => true,
      acquireSystemAudio: async (lease) => {
        calls.push(['acquire', lease]);
        return { cancelled: true, error: 'Incoming audio start was cancelled.' };
      },
      releaseSystemAudio: async (lease) => calls.push(['release', lease]),
    },
    () => {},
  );
  await assert.rejects(capture.start('s1', settings('native')), /was cancelled/);
  assert.deepEqual(calls, [
    ['acquire', 'capture-1'],
    ['release', 'capture-1'],
  ]);
});

test('a loopback input is recorded by the window without the native helper', async () => {
  const { context, requested } = browser();
  const { AudioCapture } = load('src/audio/capture.ts', context);
  const calls = [];
  const capture = new AudioCapture(
    {
      transcribe: async () => true,
      acquireSystemAudio: async () => calls.push('acquire'),
      releaseSystemAudio: async () => calls.push('release'),
    },
    () => {},
  );
  await capture.start('s1', settings('input-device', { systemAudioInputDevice: 'loopback-device' }));
  await capture.stop();
  assert.deepEqual(calls, []);
  assert.equal(requested.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(requested[1])), {
    deviceId: { exact: 'loopback-device' },
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  });
  await capture.start('s1', settings('input-device'));
  assert.equal(capture.recording, true);
  assert.match(capture.incomingError, /Choose the input device/);
  await capture.stop();
});

test('an API without leases keeps the start and stop calls', async () => {
  const { context } = browser();
  const { AudioCapture } = load('src/audio/capture.ts', context);
  const calls = [];
  const capture = new AudioCapture(
    {
      transcribe: async () => true,
      startSystemAudio: async (id) => calls.push(['start', id]),
      stopSystemAudio: async () => calls.push(['stop']),
    },
    () => {},
  );
  await capture.start('s1', settings('native'));
  await capture.stop();
  assert.deepEqual(calls, [['start', 's1'], ['stop']]);
});

// Fills one recorder node with a second of audible 16 kHz audio, as the PCM worklet would post it.
function speak(node) {
  node.port.onmessage({ data: { type: 'samples', buffer: new Int16Array(16000).fill(1000).buffer } });
}

test('choosing another incoming source during a recording switches it without stopping the recording', async () => {
  const { context, requested, nodes, stopped } = browser();
  const { AudioCapture } = load('src/audio/capture.ts', context);
  const calls = [],
    segments = [];
  const capture = new AudioCapture(
    {
      transcribe: async (segment) => segments.push([segment.sessionId, segment.speaker]),
      acquireSystemAudio: async (lease, id) => calls.push(['acquire', lease, id]) && {},
      releaseSystemAudio: async (lease) => calls.push(['release', lease]),
    },
    () => {},
  );
  await capture.start('s1', settings('native'));
  await capture.switchIncoming(settings('input-device', { systemAudioInputDevice: 'loopback-device' }));
  assert.equal(capture.recording, true);
  assert.deepEqual(calls, [
    ['acquire', 'capture-1', 's1'],
    ['release', 'capture-1'],
  ]);
  assert.equal(requested.at(-1).deviceId.exact, 'loopback-device');
  // The replaced loopback input's audio is drained into the same session before the tap starts.
  speak(nodes.at(-1));
  await capture.switchIncoming(settings('process-tap'));
  assert.ok(stopped.includes('loopback-device'));
  assert.ok(!stopped.includes('microphone'));
  assert.deepEqual(segments, [['s1', 'THEY']]);
  assert.deepEqual(calls.at(-1), ['acquire', 'capture-2', 's1']);
  await capture.switchIncoming({ ...settings('process-tap'), systemAudio: false });
  assert.deepEqual(calls.at(-1), ['release', 'capture-2']);
  await capture.stop();
  assert.equal(calls.length, 4);
});

test('a source that cannot start leaves the recording on the microphone', async () => {
  const { context } = browser({ failInput: 'missing-device' });
  const { AudioCapture } = load('src/audio/capture.ts', context);
  const calls = [],
    messages = [];
  const capture = new AudioCapture(
    {
      transcribe: async () => true,
      acquireSystemAudio: async (lease) => calls.push(['acquire', lease]) && {},
      releaseSystemAudio: async (lease) => calls.push(['release', lease]),
    },
    (message) => message && messages.push(message),
  );
  await capture.start('s1', settings('native'));
  await capture.switchIncoming(settings('input-device', { systemAudioInputDevice: 'missing-device' }));
  assert.equal(capture.recording, true);
  assert.deepEqual(messages, ['Requested device not found']);
  await capture.stop();
  assert.deepEqual(calls, [
    ['acquire', 'capture-1'],
    ['release', 'capture-1'],
  ]);
});

test('a switch is ignored when nothing is recording', async () => {
  const { context, requested } = browser();
  const { AudioCapture } = load('src/audio/capture.ts', context);
  const capture = new AudioCapture({ transcribe: async () => true }, () => {});
  await capture.switchIncoming(settings('input-device', { systemAudioInputDevice: 'loopback-device' }));
  assert.equal(requested.length, 0);
});

test('the Output (They) choices map to the saved incoming route and keep saved values', () => {
  const { context } = browser();
  const { incomingChoice, incomingSettings } = load('src/audio/incoming-choice.ts', context);
  const saved = (source, extra = {}) => ({
    systemAudio: true,
    systemAudioSource: source,
    systemAudioInputDevice: '',
    ...extra,
  });
  assert.equal(incomingChoice({ ...saved('native'), systemAudio: false }), 'none');
  assert.equal(incomingChoice(saved('electron')), 'system-audio');
  assert.equal(incomingChoice(saved('native')), 'system-audio');
  assert.equal(incomingChoice(saved('process-tap')), 'native-tap');
  assert.equal(incomingChoice(saved('input-device', { systemAudioInputDevice: 'abc' })), 'input:abc');
  assert.deepEqual({ ...incomingSettings('none', saved('native')) }, { ...saved('native'), systemAudio: false });
  assert.equal(incomingSettings('system-audio', saved('native')).systemAudioSource, 'native');
  assert.equal(incomingSettings('native-tap', saved('electron')).systemAudioSource, 'process-tap');
  assert.deepEqual(
    { ...incomingSettings('input:default', saved('native')) },
    { systemAudio: true, systemAudioSource: 'input-device', systemAudioInputDevice: 'default' },
  );
});

test('an unavailable incoming route reports its failure while preserving microphone recording', async () => {
  const { context, stopped } = browser();
  const { AudioCapture } = load('src/audio/capture.ts', context);
  const messages = [];
  const capture = new AudioCapture(
    {
      transcribe: async () => '',
      acquireSystemAudio: async () => {
        throw new Error('System audio permission denied');
      },
      releaseSystemAudio: async () => {},
    },
    (m) => messages.push(m),
  );
  await capture.start('s1', settings('native'));
  assert.equal(capture.recording, true);
  assert.match(capture.incomingError, /permission denied/);
  assert.equal(stopped.length, 0);
  await capture.stop();
  assert.ok(stopped.length > 0);
});

test('a running incoming-source error leaves the microphone listening and releases the failed lease', async () => {
  const { context } = browser();
  const { AudioCapture } = load('src/audio/capture.ts', context);
  let fail;
  let released = 0;
  const capture = new AudioCapture(
    {
      transcribe: async () => '',
      acquireSystemAudio: async () => ({}),
      releaseSystemAudio: async () => {
        released++;
      },
      onSystemAudioError: (listener) => {
        fail = listener;
        return () => {};
      },
    },
    () => {},
  );
  capture.connect();
  await capture.start('s1', settings('native'));
  fail('Output disappeared');
  await new Promise(setImmediate);
  assert.equal(capture.recording, true);
  assert.equal(capture.incomingError, 'Output disappeared');
  assert.equal(released, 1);
  await capture.stop();
  capture.dispose();
});

test('a microphone startup error is retained for settings instead of leaving an unexplained zero meter', async () => {
  const { context } = browser({ failInput: 'missing-device' });
  const { AudioCapture } = load('src/audio/capture.ts', context);
  const capture = new AudioCapture({ transcribe: async () => '' }, () => {});
  await assert.rejects(
    capture.start('s1', settings('native', { systemAudio: false, microphoneId: 'missing-device' })),
    /Requested device/,
  );
  assert.match(capture.failure, /Requested device/);
  assert.equal(capture.recording, false);
});
