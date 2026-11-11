// The recording's audio graph opens its 16 kHz context, records each source's blocks, drains them on a timer and
// when a source is removed, and closes everything at the end.
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
    require: (name) => load('src/audio/' + name.slice(2) + '.ts', context),
  });
  return moduleValue.exports;
}

function browser({ stuck = false } = {}) {
  const ticks = [],
    nodes = [],
    log = [];
  const node = () => ({ connect() {}, disconnect() {} });
  class AudioContext {
    sampleRate = 16000;
    state = 'running';
    destination = {};
    audioWorklet = { addModule: async (url) => log.push(`load ${url}`) };
    async resume() {
      log.push('resume');
    }
    async close() {
      this.state = 'closed';
      log.push('close');
    }
    createMediaStreamSource = node;
    createGain = () => ({ ...node(), gain: { value: 1 } });
  }
  class AudioWorkletNode {
    constructor() {
      nodes.push(this);
      const port = (this.port = {
        posted: [],
        onmessage: null,
        postMessage(message) {
          port.posted.push(message);
          if (message.type === 'flush' && !stuck)
            Promise.resolve().then(() => port.onmessage({ data: { type: 'flushed', id: message.id } }));
        },
        close() {},
      });
    }
    connect() {}
    disconnect() {}
  }
  let expire = () => {};
  const window = {
    setInterval: (fn) => ticks.push(fn),
    clearInterval() {},
    setTimeout: (fn) => ((expire = fn), 1),
    clearTimeout() {},
  };
  const { RecordingSources } = load('src/audio/recording-sources.ts', {
    AudioContext,
    AudioWorkletNode,
    window,
    crypto,
    Promise,
    Error,
  });
  return { RecordingSources, ticks, nodes, log, expire: () => expire() };
}

function stream(name) {
  const listeners = [];
  const track = { enabled: true, stop() {}, addEventListener: (type, fn) => listeners.push(fn) };
  return {
    name,
    track,
    end: () => listeners.forEach((fn) => fn()),
    getTracks: () => [track],
    getAudioTracks: () => [track],
  };
}

function events(extra = {}) {
  const seen = { drained: [], salvaged: [], recorded: 0, messages: [], ended: 0, failed: [] };
  return {
    seen,
    events: {
      record: (speaker, samples) => samples,
      recorded: () => seen.recorded++,
      drained: (chunks, speaker) => chunks.length && seen.drained.push([speaker, chunks.length]),
      salvage: (chunks, speaker) => seen.salvaged.push([speaker, chunks.length]),
      notify: (message) => seen.messages.push(message),
      failed: (error) => seen.failed.push(error.message),
      ended: () => seen.ended++,
      ...extra,
    },
  };
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const timing = { blockSize: 4096, drainMs: 8000, paused: false };
const speak = (node) => node.port.onmessage({ data: { type: 'samples', buffer: new Int16Array(4).fill(9).buffer } });

test('the graph loads the worklet, resumes and closes once; a source needs an open graph', async () => {
  const { RecordingSources, log } = browser();
  const sources = new RecordingSources(events().events);
  assert.throws(() => sources.add({ stream: stream('mic'), speaker: 'ME', owner: stream('mic') }, timing), /not ready/);
  await sources.open(() => {});
  assert.equal(sources.rate, 16000);
  await sources.close();
  await sources.close();
  assert.equal(sources.rate, undefined);
  assert.deepEqual(log, ['load ./pcm-worklet.js', 'resume', 'close']);
});

test('a stop during the opening still leaves the graph to close', async () => {
  const { RecordingSources, log } = browser();
  const sources = new RecordingSources(events().events);
  await assert.rejects(
    sources.open(() => {
      throw new Error('Audio startup was cancelled.');
    }),
    /cancelled/,
  );
  await sources.close();
  assert.deepEqual(log, ['load ./pcm-worklet.js', 'close']);
});

test('recorded blocks drain on the timer, and a paused recording keeps none', async () => {
  const { RecordingSources, ticks, nodes } = browser();
  let paused = false;
  const { events: on, seen } = events({ record: (speaker, samples) => (paused ? null : samples) });
  const sources = new RecordingSources(on);
  await sources.open(() => {});
  const mic = stream('mic');
  sources.add({ stream: mic, speaker: 'ME', owner: mic }, { ...timing, paused: true });
  assert.deepEqual(plain(nodes[0].port.posted), [{ type: 'pause', paused: true }]);
  speak(nodes[0]);
  paused = true;
  speak(nodes[0]);
  ticks[0]();
  await sources.drainAll();
  assert.equal(seen.recorded, 1);
  assert.deepEqual(seen.drained, [['ME', 1]]);
});

test('removing the incoming source drains it, keeps the microphone and ignores its ended track', async () => {
  const { RecordingSources, nodes } = browser();
  const { events: on, seen } = events();
  const sources = new RecordingSources(on);
  await sources.open(() => {});
  const mic = stream('mic'),
    incoming = stream('incoming');
  sources.add({ stream: mic, speaker: 'ME', owner: mic }, timing);
  sources.add({ stream: incoming, speaker: 'THEY', owner: incoming }, timing);
  speak(nodes[1]);
  await sources.detachIncoming();
  incoming.end();
  assert.deepEqual(seen.drained, [['THEY', 1]]);
  assert.equal(seen.ended, 0);
  mic.end();
  assert.equal(seen.ended, 1);
  sources.mute(true);
  assert.equal(mic.track.enabled, false);
  assert.equal(incoming.track.enabled, true, 'muting reaches only the microphone');
  sources.post({ type: 'block', size: 512 });
  assert.deepEqual(plain(nodes[0].port.posted.at(-1)), { type: 'block', size: 512 });
  assert.equal(nodes[1].port.posted.at(-1).type, 'flush', 'a removed source gets no more messages');
});

test('a worklet that stops answering fails the final drain and its blocks are salvaged', async () => {
  const { RecordingSources, nodes, expire } = browser({ stuck: true });
  const { events: on, seen } = events();
  const sources = new RecordingSources(on);
  await sources.open(() => {});
  const mic = stream('mic');
  sources.add({ stream: mic, speaker: 'ME', owner: mic }, timing);
  speak(nodes[0]);
  const drained = sources.drainAll();
  await new Promise((resolve) => setImmediate(resolve));
  expire();
  assert.match((await drained).message, /stopped responding/);
  assert.deepEqual(seen.salvaged, [['ME', 1]]);
  assert.match(seen.messages[0], /stopped responding/);
});
