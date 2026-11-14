// The session recording with echo reduction: browser audio objects are fakes, but the canceller is the real AEC3
// wasm. Synthetic call audio goes through the capture exactly as worklet blocks and helper packets do.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  vm = require('node:vm'),
  ts = require('typescript');
const { loadTs } = require('./helpers/load-ts.cjs');
const WebRtcAec3 = require('@ennuicastr/webrtcaec3.js');

const RATE = 16000;
const realm = { performance, console, Float32Array, Int16Array };
const { EchoReduction } = loadTs('src/audio/echo-reduction.ts', realm);

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

function browser() {
  const nodes = [];
  const node = () => ({ connect() {}, disconnect() {} });
  const stream = () => {
    const track = { stop() {}, addEventListener() {}, removeEventListener() {}, enabled: true };
    return { getTracks: () => [track], getAudioTracks: () => [track] };
  };
  class AudioContext {
    sampleRate = RATE;
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
    constructor(_context, _name, options) {
      this.options = options;
      nodes.push(this);
    }
    posted = [];
    port = {
      onmessage: null,
      postMessage: (message) => {
        this.posted.push(message.type === 'flush' ? 'flush' : message);
        if (message.type === 'flush')
          Promise.resolve().then(() => this.port.onmessage?.({ data: { type: 'flushed', id: message.id } }));
      },
      close() {},
    };
    connect() {}
    disconnect() {}
  }
  return {
    nodes,
    context: {
      AudioContext,
      AudioWorkletNode,
      MediaStream: class {},
      navigator: { mediaDevices: { getUserMedia: async () => stream() } },
      window: { setInterval: () => 1, clearInterval() {}, setTimeout: (fn) => setTimeout(fn, 1), clearTimeout },
      crypto,
      setTimeout,
      clearTimeout,
      Promise,
      Error,
      Float32Array,
      Int16Array,
    },
  };
}

function api() {
  const pushed = { ME: [], THEY: [] };
  const listeners = {};
  return {
    pushed,
    emitSystemAudio: (segment) => listeners.systemAudio?.(segment),
    startLiveTranscription: async () => true,
    stopLiveTranscription: async () => true,
    pushLiveAudio: async ({ speaker, samples }) => {
      pushed[speaker].push(new Int16Array(samples));
      return true;
    },
    transcribe: async () => true,
    acquireSystemAudio: async () => ({}),
    releaseSystemAudio: async () => true,
    onSystemAudio: (listener) => ((listeners.systemAudio = listener), () => {}),
  };
}

const settings = (extra = {}) => ({
  microphoneId: 'default',
  systemAudio: true,
  systemAudioSource: 'input-device',
  systemAudioInputDevice: 'loopback',
  liveTranscription: true,
  transcriptionProvider: 'local',
  ...extra,
});

function voice(seconds, seed, pitch) {
  let state = seed;
  const random = () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  const out = new Float32Array(seconds * RATE);
  let low = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    low = 0.7 * low + 0.3 * random();
    out[i] =
      0.25 * Math.max(0, Math.sin(2 * Math.PI * 2.7 * t + seed)) * (low + 0.6 * Math.sin(2 * Math.PI * pitch * t));
  }
  return out;
}
function room(far, delayMs, gain) {
  const delay = Math.round((delayMs * RATE) / 1000),
    taps = [1, 0.5, -0.3, 0.2, 0.1, -0.05];
  const out = new Float32Array(far.length);
  for (let i = 0; i < far.length; i++) {
    let value = 0;
    for (let k = 0; k < taps.length; k++) if (i - delay - k * 8 >= 0) value += taps[k] * far[i - delay - k * 8];
    out[i] = gain * value;
  }
  return out;
}
const pcm16 = (samples) => Int16Array.from(samples, (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767))));
const rms = (samples) => Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / Math.max(1, samples.length));
const joined = (chunks) => {
  const out = new Int16Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};
const post = (worklet, samples) =>
  worklet.port.onmessage({ data: { type: 'samples', buffer: samples.slice().buffer } });

function recording({ echo = null } = {}) {
  const b = browser(),
    a = api();
  const { AudioCapture } = load('src/audio/capture.ts', b.context);
  const messages = [];
  const capture = new AudioCapture(a, (message) => message && messages.push(message), echo ? { echo } : {});
  capture.connect();
  return { capture, nodes: b.nodes, api: a, messages };
}

test('with echo reduction on, the recorded microphone loses the echo of the incoming audio', async () => {
  let clock = 0;
  const logs = [];
  const echo = new EchoReduction({ load: () => WebRtcAec3(), now: () => clock, log: (message) => logs.push(message) });
  const { capture, nodes, api } = recording({ echo });
  await capture.start('session', settings({ echoReductionEnabled: true }));
  const [mic, incoming] = nodes;
  assert.equal(mic.options.processorOptions.blockSize, 512);
  assert.equal(incoming.options.processorOptions.blockSize, 512);
  const far = voice(10, 3, 190),
    heard = room(far, 40, 0.6);
  // Both worklets post 32 ms blocks; the incoming block of each step arrives first, as either order may.
  for (let at = 0; at < far.length; at += 512) {
    clock += 32;
    post(incoming, pcm16(far.subarray(at, at + 512)));
    post(mic, pcm16(heard.subarray(at, at + 512)));
  }
  await capture.stop();
  const me = joined(api.pushed.ME);
  const settled = (samples) => Float32Array.from(samples.subarray(samples.length / 2), (v) => v / 32768);
  const erle = 20 * Math.log10(rms(settled(pcm16(heard))) / rms(settled(me)));
  assert.ok(erle > 20, `echo return loss enhancement ${erle.toFixed(1)} dB`);
  // The incoming side is recorded as it was.
  assert.deepEqual([...joined(api.pushed.THEY).subarray(0, 512)], [...pcm16(far.subarray(0, 512))]);
  assert.deepEqual(logs, ['[AEC3] ready at 48000 Hz with 200 ms microphone alignment']);
  // Stopping releases both sides of the canceller.
  assert.equal(echo.captures.size, 0);
  assert.equal(echo.references.size, 0);
});

test('the helper packets of the native route are the echo reference', async () => {
  let clock = 0;
  const echo = new EchoReduction({ load: () => WebRtcAec3(), now: () => clock, log() {} });
  const { capture, nodes, api } = recording({ echo });
  await capture.start('session', settings({ echoReductionEnabled: true, systemAudioSource: 'process-tap' }));
  assert.equal(nodes.length, 1);
  const far = voice(10, 3, 190),
    heard = room(far, 40, 0.6);
  let sent = 0;
  for (let at = 0; at < far.length; at += 512) {
    clock += 32;
    // The helper's live packets are 100 ms; each arrives once its last sample has played.
    for (; sent + 1600 <= at + 512; sent += 1600) {
      const packet = pcm16(far.subarray(sent, sent + 1600));
      const bytes = new Uint8Array(44 + packet.byteLength);
      bytes.set(new Uint8Array(packet.buffer), 44);
      api.emitSystemAudio({ sessionId: 'session', speaker: 'THEY', mime: 'audio/wav', bytes: bytes.buffer });
    }
    post(nodes[0], pcm16(heard.subarray(at, at + 512)));
  }
  await capture.stop();
  const me = joined(api.pushed.ME);
  const settled = (samples) => Float32Array.from(samples.subarray(samples.length / 2), (v) => v / 32768);
  const erle = 20 * Math.log10(rms(settled(pcm16(heard))) / rms(settled(me)));
  assert.ok(erle > 20, `echo return loss enhancement ${erle.toFixed(1)} dB`);
});

for (const deliveryLagMs of [0, 40, 80]) {
  test(`nearby Mac playback is cancelled with 100 ms native packets and ${deliveryLagMs} ms delivery lag`, async () => {
    let clock = 0;
    const echo = new EchoReduction({ load: () => WebRtcAec3(), now: () => clock, log() {} });
    const { capture, nodes, api } = recording({ echo });
    await capture.start(
      'session',
      settings({
        echoReductionEnabled: true,
        systemAudioSource: 'native',
        transcriptionProvider: 'apple',
      }),
    );
    const far = voice(10, 3, 190),
      heard = room(far, 0, 0.6);
    let sent = 0;
    for (let at = 0; at < far.length; at += 512) {
      clock += 32;
      // Speakers beside the microphone have no helpful acoustic delay. Only complete packets can arrive.
      for (; sent + 1600 <= at + 512 - (deliveryLagMs * RATE) / 1000; sent += 1600) {
        const packet = pcm16(far.subarray(sent, sent + 1600));
        const bytes = new Uint8Array(44 + packet.byteLength);
        bytes.set(new Uint8Array(packet.buffer), 44);
        api.emitSystemAudio({ sessionId: 'session', speaker: 'THEY', mime: 'audio/wav', bytes: bytes.buffer });
      }
      post(nodes[0], pcm16(heard.subarray(at, at + 512)));
    }
    await capture.stop();
    const me = joined(api.pushed.ME);
    const settled = (samples) => Float32Array.from(samples.subarray(samples.length / 2), (v) => v / 32768);
    const erle = 20 * Math.log10(rms(settled(pcm16(heard))) / rms(settled(me)));
    assert.ok(erle > 30, `Mac playback still reaches ME: ${erle.toFixed(1)} dB suppression`);
    assert.equal(api.pushed.THEY.length, 0, 'Apple Speech gets native output directly, without renderer duplication');
  });
}

test('with echo reduction off, or outside the session recording, the microphone is recorded untouched', async () => {
  let loads = 0;
  const echo = new EchoReduction({
    load: async () => {
      loads++;
      return WebRtcAec3();
    },
    now: () => 0,
    log() {},
  });
  const off = recording({ echo });
  await off.capture.start('session', settings({ echoReductionEnabled: false }));
  assert.equal(off.nodes[0].options.processorOptions.blockSize, 4096);
  const block = pcm16(voice(1, 5, 150).subarray(0, 4096));
  post(off.nodes[0], block);
  await off.capture.stop();
  assert.deepEqual([...joined(off.api.pushed.ME)], [...block]);
  assert.equal(loads, 0);

  // Dictation and the local voice record without the window's echo reduction.
  const plain = recording();
  await plain.capture.start('session', settings({ echoReductionEnabled: true }));
  assert.equal(plain.nodes[0].options.processorOptions.blockSize, 4096);
  post(plain.nodes[0], block);
  await plain.capture.stop();
  assert.deepEqual([...joined(plain.api.pushed.ME)], [...block]);
});

test('a canceller that cannot load leaves the recording running on the unprocessed microphone', async () => {
  const logs = [];
  const echo = new EchoReduction({
    load: async () => {
      throw new Error('wasm compile blocked');
    },
    now: () => 0,
    log: (message) => logs.push(message),
  });
  const { capture, nodes, api, messages } = recording({ echo });
  await capture.start('session', settings({ echoReductionEnabled: true }));
  assert.equal(capture.recording, true);
  const block = pcm16(voice(1, 5, 150).subarray(0, 512));
  post(nodes[0], block);
  await capture.stop();
  assert.deepEqual([...joined(api.pushed.ME)], [...block]);
  assert.deepEqual(logs, ['[AEC3] unavailable; using unprocessed microphone audio (wasm compile blocked)']);
  assert.deepEqual(messages, []);
});

test('turning echo reduction on during a recording switches to 32 ms blocks and starts cancelling', async () => {
  let clock = 0;
  const echo = new EchoReduction({ load: () => WebRtcAec3(), now: () => clock, log() {} });
  const { capture, nodes, api } = recording({ echo });
  await capture.start('session', settings({ echoReductionEnabled: false }));
  const [mic, incoming] = nodes;
  assert.equal(mic.options.processorOptions.blockSize, 4096);
  capture.updateEchoReduction(true);
  // Copied out of the capture's realm so strict equality compares plain objects.
  const sent = (worklet) => worklet.posted.map((message) => (typeof message === 'object' ? { ...message } : message));
  assert.deepEqual(sent(mic), [{ type: 'block', size: 512 }]);
  assert.deepEqual(sent(incoming), [{ type: 'block', size: 512 }]);
  const far = voice(10, 3, 190),
    heard = room(far, 40, 0.6);
  for (let at = 0; at < far.length; at += 512) {
    clock += 32;
    post(incoming, pcm16(far.subarray(at, at + 512)));
    post(mic, pcm16(heard.subarray(at, at + 512)));
    // The first block starts loading the canceller; real audio keeps arriving while it loads.
    if (at === 0) await echo.loadModule();
  }
  const me = joined(api.pushed.ME.splice(0));
  capture.updateEchoReduction(false);
  assert.deepEqual(sent(mic).at(-1), { type: 'block', size: 4096 });
  const block = pcm16(voice(1, 5, 150).subarray(0, 4096));
  post(mic, block);
  await capture.stop();
  const settled = (samples) => Float32Array.from(samples.subarray(samples.length / 2), (v) => v / 32768);
  const recorded = joined(api.pushed.ME);
  const before = me.length ? me : recorded.subarray(0, recorded.length - block.length);
  const erle = 20 * Math.log10(rms(settled(pcm16(heard))) / rms(settled(before)));
  assert.ok(erle > 20, `echo return loss enhancement ${erle.toFixed(1)} dB`);
  // Turned off again, the microphone is recorded as it came.
  assert.deepEqual([...recorded.subarray(recorded.length - block.length)], [...block]);
});

test('pause drops microphone and native output frames while preserving the live session and resumes without restart', async () => {
  const { capture, nodes, api } = recording({});
  const changes = [];
  api.setLivePaused = async (value) => {
    changes.push(value);
    return true;
  };
  await capture.start('session', settings({ systemAudioSource: 'native' }));
  const mic = nodes[0],
    frame = new Int16Array([1000, 2000, 3000]);
  await capture.togglePause();
  assert.equal(capture.recording, true);
  assert.equal(capture.paused, true);
  post(mic, frame);
  api.emitSystemAudio({ sessionId: 'session', speaker: 'THEY', bytes: new ArrayBuffer(44 + frame.byteLength) });
  assert.equal(api.pushed.ME.length, 0);
  assert.equal(api.pushed.THEY.length, 0);
  await capture.togglePause();
  assert.equal(capture.paused, false);
  post(mic, frame);
  await capture.stop();
  assert.deepEqual(changes, [true, false]);
  assert.deepEqual([...joined(api.pushed.ME)], [...frame]);
});

test('a pause the live captions refuse puts the worklets back and keeps recording unpaused', async () => {
  const { capture, nodes, api } = recording({});
  api.setLivePaused = async () => {
    throw new Error('Speech did not pause.');
  };
  await capture.start(
    'session',
    settings({ systemAudio: false, liveTranscription: true, transcriptionProvider: 'apple' }),
  );
  await assert.rejects(capture.togglePause(), /did not pause/);
  assert.equal(capture.paused, false);
  assert.equal(capture.recording, true);
  const pauses = nodes[0].posted.filter((message) => message.type === 'pause').map((message) => message.paused);
  assert.deepEqual(pauses, [true, false]);
  await capture.stop();
});
