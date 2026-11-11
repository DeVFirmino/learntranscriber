const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCaptionPublisher } = require('../src/main/application/audio/caption-publication.cjs');

test('a caption is noted, sent to every window, and only a final one with text changes the state', () => {
  const log = [];
  const publish = createCaptionPublisher({
    speech: { heard: (caption) => log.push(['heard', caption.text]) },
    broadcast: (channel, caption) => log.push([channel, caption.text]),
    changed: () => log.push(['changed']),
  });
  publish({ speaker: 'ME', text: 'interim', final: false });
  publish({ speaker: 'ME', text: '', final: true });
  publish({ speaker: 'THEM', text: 'saved', final: true });
  assert.deepEqual(log, [
    ['heard', 'interim'],
    ['live:caption', 'interim'],
    ['heard', ''],
    ['live:caption', ''],
    ['heard', 'saved'],
    ['live:caption', 'saved'],
    ['changed'],
  ]);
});
