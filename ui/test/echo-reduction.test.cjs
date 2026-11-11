const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadTs } = require('./helpers/load-ts.cjs');

// The module runs in its own realm; it shares the typed arrays so the test's audio is recognised.
const realm = { performance, console, Float32Array, Int16Array, atob };
const { EchoReduction } = loadTs('src/audio/echo-reduction.ts', realm);
const { CAPTURE_DELAY_MS } = loadTs('src/audio/aec3.ts', realm);
const { strictAec3Source, AEC3_BUILD } = loadTs('src/audio/aec3-source.ts', realm);
const { decodeDataUrl } = loadTs('src/audio/aec3-module.ts', realm);
const WebRtcAec3 = require('@ennuicastr/webrtcaec3.js');

const RATE = 16000;
const DIST = path.dirname(require.resolve('@ennuicastr/webrtcaec3.js'));
const REFERENCE_WASM_SHA256 = 'a2f432546daf1b366d04b4921e1a1cdf0d097da7722fb1d5fe553bed3cadb756';

// Synthetic voices: noise and a pitched tone under a syllable-rate envelope, reproducible from a seed.
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
// What a microphone hears of the speakers: delayed, attenuated and smeared by a few reflections.
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
const correlation = (a, b) => {
  let ab = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    ab += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return ab / Math.sqrt(aa * bb);
};

// Plays the call as the capture does: incoming audio in 100 ms packets, the microphone in 4096-sample blocks.
async function call(far, mic, { load = () => WebRtcAec3() } = {}) {
  let clock = 0;
  const logs = [];
  const bus = new EchoReduction({ load, now: () => clock, log: (message) => logs.push(message) });
  bus.setEnabled(true);
  const reference = bus.reference(),
    capture = bus.capture();
  const ready = await capture.prepare();
  const blocks = [];
  for (let at = 0; at < mic.length; at += 4096) {
    const end = Math.min(at + 4096, mic.length);
    for (let r = at; r < end; r += 1600) reference.analyzePCM16(pcm16(far.subarray(r, Math.min(r + 1600, end))), RATE);
    clock += 256;
    blocks.push(Float32Array.from(capture.processFloat32(mic.subarray(at, end), RATE)));
  }
  capture.release();
  reference.release();
  const out = new Float32Array(blocks.reduce((sum, block) => sum + block.length, 0));
  let offset = 0;
  for (const block of blocks) {
    out.set(block, offset);
    offset += block.length;
  }
  return { out, logs, ready };
}

// A canceller stand-in that records calls, for the lifecycle rules that do not depend on the DSP.
function fakeModule(calls = []) {
  return {
    calls,
    AEC3: class {
      constructor(...args) {
        calls.push(['new', ...args]);
      }
      analyze(data, options) {
        calls.push(['analyze', data[0].length, options.sampleRateIn]);
      }
      processSize(data) {
        return data[0].length;
      }
      process(out, data) {
        calls.push(['process', data[0].length]);
        out[0].set(data[0].map((v) => v / 2));
      }
      free() {
        calls.push(['free']);
      }
    },
  };
}

test('the reference AEC3 wasm removes a synthetic room echo of the incoming audio', async () => {
  const far = voice(12, 3, 190),
    echo = room(far, 40, 0.6);
  const { out, logs, ready } = await call(far, echo);
  assert.equal(ready, true);
  // AEC3 works in 10 ms frames, so at most one frame is still inside it at the end.
  assert.ok(echo.length - out.length >= 0 && echo.length - out.length < 160);
  const settled = (samples) => samples.subarray(samples.length / 2);
  const erle = 20 * Math.log10(rms(settled(echo)) / rms(settled(out)));
  assert.ok(erle > 20, `echo return loss enhancement ${erle.toFixed(1)} dB`);
  assert.deepEqual(logs, ['[AEC3] ready at 48000 Hz with 60 ms microphone alignment']);
});

test('speech near the microphone survives, alone and over the echo', async () => {
  const far = voice(12, 3, 190),
    near = voice(12, 11, 120),
    echo = room(far, 40, 0.6);
  const alone = (await call(new Float32Array(far.length), near)).out;
  assert.ok(rms(alone.subarray(96000)) / rms(near.subarray(96000)) > 0.8);
  const mixed = echo.map((v, i) => v + near[i]);
  const { out } = await call(far, mixed);
  // The output follows the near voice 60 ms of alignment plus the canceller's own latency later.
  const window = out.subarray(96000, 176000);
  const at = (source, lag) => source.subarray(96000 - lag, 176000 - lag);
  let best = { lag: 0, value: 0 };
  for (let lag = 900; lag <= 1400; lag++) {
    const value = correlation(window, at(near, lag));
    if (value > best.value) best = { lag, value };
  }
  assert.ok(best.lag >= (CAPTURE_DELAY_MS * RATE) / 1000, `lag ${best.lag}`);
  assert.ok(best.value > 0.9, `near correlation ${best.value.toFixed(3)}`);
  assert.ok(Math.abs(correlation(window, at(echo, best.lag))) < 0.1);
  assert.ok(correlation(at(mixed, 0), at(near, 0)) < best.value);
});

test('until the canceller is ready the microphone is held back exactly 60 ms', async () => {
  let resolve;
  const bus = new EchoReduction({ load: () => new Promise((done) => (resolve = done)), now: () => 0, log() {} });
  bus.setEnabled(true);
  bus.reference();
  const capture = bus.capture();
  const block = Float32Array.from({ length: 2048 }, (_, i) => (i + 1) / 4096);
  const out = Float32Array.from(capture.processFloat32(block, RATE));
  assert.deepEqual([...out.subarray(0, 960)], new Array(960).fill(0));
  assert.deepEqual([...out.subarray(960)], [...block.subarray(0, 2048 - 960)]);
  resolve(fakeModule());
});

test('echo reduction stays off until the user turns it on, and off leaves the microphone untouched', async () => {
  let loads = 0;
  const calls = [];
  const bus = new EchoReduction({ load: async () => (loads++, fakeModule(calls)), now: () => 0, log() {} });
  bus.reference();
  const capture = bus.capture();
  const block = new Float32Array(1024).fill(0.25);
  assert.equal(await capture.prepare(), false);
  assert.equal(capture.processFloat32(block, RATE), block);
  assert.equal(loads, 0);
  bus.setEnabled(true);
  assert.equal(await capture.prepare(), true);
  bus.setEnabled(false);
  assert.deepEqual(calls.at(-1), ['free']);
  assert.equal(capture.processFloat32(block, RATE), block);
  // Without any incoming audio there is nothing to cancel, so nothing is loaded either.
  const lone = new EchoReduction({ load: async () => (loads++, fakeModule()), now: () => 0, log() {} });
  lone.setEnabled(true);
  assert.equal(await lone.capture().prepare(), false);
  assert.equal(loads, 1);
});

test('a reference older than 500 ms resets the canceller and passes the aligned microphone', async () => {
  let clock = 0;
  const calls = [];
  const bus = new EchoReduction({ load: async () => fakeModule(calls), now: () => clock, log() {} });
  bus.setEnabled(true);
  const reference = bus.reference(),
    capture = bus.capture();
  await capture.prepare();
  const block = new Float32Array(1600).fill(0.5);
  capture.processFloat32(block, RATE);
  reference.analyzePCM16(new Int16Array(1600).fill(1000), RATE);
  capture.processFloat32(block, RATE);
  assert.deepEqual(
    calls.filter(([name]) => name !== 'new'),
    [
      ['analyze', 1600, RATE],
      ['process', 1600],
    ],
  );
  clock += 501;
  const out = capture.processFloat32(block, RATE);
  assert.deepEqual(calls.slice(-2), [['free'], ['new', 48000, 1, 1]]);
  assert.ok(out.every((v) => v === 0.5));
});

test('a module that cannot load, or fails while running, leaves the microphone unprocessed', async () => {
  const logs = [];
  const broken = new EchoReduction({
    load: async () => {
      throw new Error('wasm compile blocked');
    },
    now: () => 0,
    log: (message) => logs.push(message),
  });
  broken.setEnabled(true);
  broken.reference();
  const capture = broken.capture();
  assert.equal(await capture.prepare(), false);
  assert.deepEqual(logs, ['[AEC3] unavailable; using unprocessed microphone audio (wasm compile blocked)']);
  const block = new Float32Array(512).fill(0.1);
  assert.equal(capture.processFloat32(block, RATE), block);

  const failing = fakeModule();
  failing.AEC3.prototype.process = () => {
    throw new Error('memory access out of bounds');
  };
  const running = new EchoReduction({ load: async () => failing, now: () => 0, log: (message) => logs.push(message) });
  running.setEnabled(true);
  const reference = running.reference(),
    mic = running.capture();
  await mic.prepare();
  mic.processFloat32(block, RATE);
  reference.analyzePCM16(new Int16Array(512).fill(100), RATE);
  assert.equal(mic.processFloat32(block, RATE), block);
  assert.equal(
    logs.at(-1),
    '[AEC3] capture processing failed; using unprocessed microphone audio (memory access out of bounds)',
  );
  assert.equal(mic.processFloat32(block, RATE), block);
});

test('when the last incoming source goes, the held-back audio comes out once and the canceller is freed', async () => {
  const calls = [];
  const bus = new EchoReduction({ load: async () => fakeModule(calls), now: () => 0, log() {} });
  bus.setEnabled(true);
  const reference = bus.reference(),
    capture = bus.capture();
  await capture.prepare();
  const block = Float32Array.from({ length: 1600 }, (_, i) => i / 1600);
  capture.processFloat32(block, RATE);
  reference.release();
  const out = capture.processFloat32(block, RATE);
  assert.equal(out.length, 960 + 1600);
  assert.deepEqual([...out.subarray(0, 960)], [...block.subarray(1600 - 960)]);
  assert.equal(calls.at(-1)[0], 'free');
  assert.equal(capture.processFloat32(block, RATE), block);
});

test('pausing drops the held-back audio, and release frees the canceller for good', async () => {
  const calls = [];
  const bus = new EchoReduction({ load: async () => fakeModule(calls), now: () => 0, log() {} });
  bus.setEnabled(true);
  bus.reference();
  const capture = bus.capture();
  await capture.prepare();
  const block = new Float32Array(1600).fill(0.5);
  capture.processFloat32(block, RATE);
  capture.resetCapture();
  assert.equal(capture.active, false);
  // A fresh start begins with silence again: nothing from before the pause comes out.
  assert.ok(
    capture
      .processFloat32(block, RATE)
      .subarray(0, 960)
      .every((v) => v === 0),
  );
  capture.release();
  assert.equal(calls.at(-1)[0], 'free');
  assert.equal(bus.captures.size, 0);
  assert.equal(capture.processFloat32(block, RATE), block);
  assert.equal(await capture.prepare(), false);
});

test('the bundler transform makes the AEC3 build strict-safe, and it runs the same wasm in a renderer-like realm', async () => {
  const file = path.join(DIST, 'webrtcaec3-0.3.0.js');
  assert.match(file, AEC3_BUILD);
  const source = fs.readFileSync(file, 'utf8');
  const strict = strictAec3Source(source);
  assert.ok(!strict.includes('data:application/wasm;base64,'));
  assert.throws(() => strictAec3Source('WebRtcAec3Wasm = 1;'), /AEC3 build changed/);
  // Strict mode, a window and no process, as in the sandboxed renderer; the wasm is passed in.
  const module = { exports: {} };
  vm.runInNewContext(`"use strict";\n${strict}`, { module, exports: module.exports, window: {}, console });
  const wasmBinary = new Uint8Array(fs.readFileSync(path.join(DIST, 'webrtcaec3-0.3.0.wasm')));
  const aec3 = await module.exports({ wasmBinary });
  const aec = new aec3.AEC3(48000, 1, 1);
  const far = voice(4, 3, 190),
    echo = room(far, 40, 0.6),
    out = [];
  for (let at = 0; at < echo.length; at += 1600) {
    aec.analyze([far.subarray(at, at + 1600)], { sampleRateIn: RATE });
    const block = echo.subarray(at, at + 1600),
      options = { sampleRateIn: RATE, sampleRateOut: RATE };
    const processed = [new Float32Array(aec.processSize([block], options))];
    aec.process(processed, [block], options);
    out.push(...processed[0]);
  }
  aec.free();
  assert.ok(rms(out.slice(-RATE)) < rms(echo.subarray(-RATE)) / 10);
});

test('the inline wasm asset decodes to the binary the reference bundles', () => {
  const bytes = fs.readFileSync(path.join(DIST, 'webrtcaec3-0.3.0.wasm'));
  const decoded = decodeDataUrl(`data:application/wasm;base64,${bytes.toString('base64')}`);
  assert.equal(crypto.createHash('sha256').update(decoded).digest('hex'), REFERENCE_WASM_SHA256);
  assert.throws(() => decodeDataUrl('https://example.invalid/aec.wasm'), /Invalid AEC3 wasm asset/);
});
