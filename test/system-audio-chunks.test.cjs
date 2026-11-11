const { test } = require('node:test');
const assert = require('node:assert/strict');
const { routeSystemAudioChunks } = require('../src/main/application/audio/system-audio-chunks.cjs');

test('only chunks of the live session reach Apple speech and the renderers', () => {
  const pushed = [],
    sent = [];
  let apple = null;
  const route = routeSystemAudioChunks({
    active: { id: () => 's1' },
    appleSpeech: () => apple,
    broadcast: (channel, chunk) => sent.push([channel, chunk.seq]),
  });
  route({ sessionId: 's1', seq: 1 });
  apple = { pushSystem: (chunk) => pushed.push(chunk.seq) };
  route({ sessionId: 's1', seq: 2 });
  route({ sessionId: 'old', seq: 3 });
  assert.deepEqual(pushed, [2]);
  assert.deepEqual(sent, [
    ['audio:native-chunk', 1],
    ['audio:native-chunk', 2],
  ]);
});
