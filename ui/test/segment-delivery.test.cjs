// Recorded audio reaches transcription in order per speaker, and audio that cannot be delivered is kept for a retry.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { SegmentDelivery } = loadTs('src/audio/segment-delivery.ts', { crypto, Promise, Error });

function delivery(api, { recording = true } = {}) {
  const messages = [];
  let halts = 0;
  const sent = new SegmentDelivery({
    api,
    notify: (message) => message && messages.push(message),
    recording: () => recording,
    halt: () => halts++,
  });
  return { sent, messages, halts: () => halts };
}
const segment = (speaker, name) => ({ sessionId: 's1', speaker, mime: 'audio/wav', bytes: new ArrayBuffer(8), name });

test('segments of one speaker are transcribed one after another, each with a stable id', async () => {
  const order = [];
  let release;
  const first = new Promise((resolve) => (release = resolve));
  const { sent } = delivery({
    transcribe: async (input) => {
      if (input.name === 'a') await first;
      order.push(input.name);
    },
  });
  const a = segment('ME', 'a');
  sent.segment(a);
  sent.segment(segment('ME', 'b'));
  assert.equal(sent.pending, 2);
  release();
  await sent.settled();
  assert.deepEqual(order, ['a', 'b']);
  assert.equal(sent.pending, 0);
  assert.ok(a.segmentId);
});

test('a failed transcription keeps the segment and ends a running recording', async () => {
  const api = {
    transcribe: async () => {
      throw new Error('The provider is unavailable.');
    },
  };
  const running = delivery(api);
  running.sent.segment(segment('ME', 'a'));
  await running.sent.settled();
  assert.equal(running.sent.failed.length, 1);
  assert.deepEqual(running.messages, ['The provider is unavailable.']);
  assert.equal(running.halts(), 1);

  const stopped = delivery(api, { recording: false });
  stopped.sent.segment(segment('ME', 'a'));
  await stopped.sent.settled();
  assert.equal(stopped.sent.failed.length, 1);
  assert.equal(stopped.halts(), 0, 'a stopped recording is not stopped again');
});

test('more than six waiting segments stop the recording as falling behind', async () => {
  const { sent, messages, halts } = delivery({ transcribe: () => new Promise(() => {}) });
  for (let index = 0; index < 7; index++) sent.segment(segment('ME', String(index)));
  assert.equal(halts(), 1);
  assert.match(messages[0], /falling behind/);
});

test('live audio goes out in frames of two seconds, and a refused frame is kept and fails the next stop once', async () => {
  const frames = [];
  const { sent, halts } = delivery({
    pushLiveAudio: async (input) => {
      frames.push(new Int16Array(input.samples).length);
      if (frames.length === 2) throw new Error('Apple Speech is busy.');
    },
  });
  sent.live(new Int16Array(40000), 'THEY', 's1');
  await sent.settled();
  assert.deepEqual(frames, [32000, 8000]);
  assert.equal(sent.failed.length, 1);
  assert.equal(sent.failed[0].speaker, 'THEY');
  assert.equal(sent.failed[0].bytes.byteLength, 44 + 8000 * 2);
  assert.equal(halts(), 1);
  assert.match(sent.takeLiveFailure().message, /busy/);
  assert.equal(sent.takeLiveFailure(), undefined);
});

test('retry sends the kept segments again, and discard drops them', async () => {
  let fail = true;
  const sent = [];
  const { sent: queue } = delivery(
    {
      transcribe: async (input) => {
        if (fail) throw new Error('offline');
        sent.push(input.name);
      },
    },
    { recording: false },
  );
  queue.segment(segment('ME', 'a'));
  queue.salvaged([new Int16Array([1])], 'THEY', { sessionId: 's1', live: false, rate: 16000 });
  await queue.settled();
  fail = false;
  await queue.retry();
  assert.equal(sent.length, 2);
  assert.equal(queue.failed.length, 0);
  queue.salvaged([new Int16Array([1])], 'ME', { sessionId: 's1', live: false, rate: 16000 });
  queue.discard();
  assert.equal(queue.failed.length, 0);
});

test('a drain becomes live frames while live captions run, otherwise a segment unless it is silent or short', async () => {
  const frames = [],
    segments = [];
  const { sent } = delivery({
    pushLiveAudio: async (input) => frames.push(new Int16Array(input.samples).length),
    transcribe: async (input) => segments.push(input.bytes.byteLength),
  });
  sent.drained([new Int16Array(600), new Int16Array(600)], 'ME', { sessionId: 's1', live: true });
  sent.drained([new Int16Array(2000).fill(100)], 'ME', { sessionId: 's1', live: false, rate: 16000 });
  sent.drained([new Int16Array(2000)], 'ME', { sessionId: 's1', live: false, rate: 16000 });
  sent.drained([new Int16Array(500).fill(100)], 'ME', { sessionId: 's1', live: false, rate: 16000 });
  sent.drained([new Int16Array(2000).fill(100)], 'ME', { sessionId: 's1', live: false });
  await sent.settled();
  assert.deepEqual(frames, [1200]);
  assert.deepEqual(segments, [44 + 4000]);
});
