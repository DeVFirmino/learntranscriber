// A recorded source connects to the PCM worklet silently, drains on request and releases its tracks and graph.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

function graph() {
  const events = [];
  const node = (name) => ({
    connect: (target) => events.push(`${name}->${target.name}`),
    disconnect: () => events.push(`${name} disconnected`),
    name,
  });
  class AudioWorkletNode {
    constructor(context, processor, options) {
      Object.assign(this, node('worklet'));
      this.processor = processor;
      this.options = options;
      this.posted = [];
      this.port = { postMessage: (message) => this.posted.push(message), close: () => events.push('port closed') };
    }
  }
  const context = {
    destination: { name: 'speakers' },
    createMediaStreamSource: () => node('source'),
    createGain: () => ({ ...node('sink'), gain: { value: 1 } }),
  };
  return { events, context, AudioWorkletNode };
}

test('the worklet output reaches the speakers only through a muted sink', () => {
  const { events, context, AudioWorkletNode } = graph();
  const { createInput } = loadTs('src/audio/worklet-input.ts', { AudioWorkletNode });
  const stream = {};
  const input = createInput(context, stream, 'ME', stream, 512);
  assert.equal(input.node.processor, 'pcm-recorder');
  assert.equal(input.node.options.processorOptions.blockSize, 512);
  assert.equal(input.sink.gain.value, 0);
  assert.deepEqual(events, ['source->worklet', 'worklet->sink', 'sink->speakers']);
});

test('a drain resolves when the worklet acknowledges it and fails when it never does', async () => {
  const { context, AudioWorkletNode } = graph();
  let expire;
  const window = { setTimeout: (fn) => ((expire = fn), 1), clearTimeout: () => {} };
  const { createInput, drainWorklet } = loadTs('src/audio/worklet-input.ts', {
    AudioWorkletNode,
    window,
    crypto,
    Promise,
    Error,
  });
  const input = createInput(context, {}, 'ME', {}, 4096);
  const drained = drainWorklet(input, true);
  const [request] = input.node.posted;
  assert.equal(request.type, 'flush');
  assert.equal(request.stop, true);
  input.acks.get(request.id)();
  await drained;
  assert.equal(input.acks.size, 0);

  const stuck = drainWorklet(input, false);
  expire();
  await assert.rejects(stuck, /stopped responding/);
  assert.equal(input.acks.size, 0);
});

test('releasing a source stops its owner tracks and disconnects the graph', () => {
  const { events, context, AudioWorkletNode } = graph();
  const { createInput, releaseInput } = loadTs('src/audio/worklet-input.ts', { AudioWorkletNode });
  const owner = { getTracks: () => [{ stop: () => events.push('track stopped') }] };
  const input = createInput(context, {}, 'THEY', owner, 4096);
  events.length = 0;
  releaseInput(input);
  assert.deepEqual(events, [
    'track stopped',
    'source disconnected',
    'worklet disconnected',
    'sink disconnected',
    'port closed',
  ]);
});
