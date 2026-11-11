const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createOwnerCleanup } = require('../src/main/application/runtime/owner-cleanup.cjs');

test('a destroyed window cancels its requests, then stops its live transcription', () => {
  const log = [];
  const engine = (name) => ({ stop: async (owner, force) => log.push(`${name} stop ${owner} ${force}`) });
  const cleanup = createOwnerCleanup({
    requests: { cancelOwner: (owner) => log.push(`requests ${owner}`) },
    transcribers: () => [engine('whisper'), undefined, engine('apple')],
  });
  cleanup.destroyed(4);
  assert.deepEqual(log, ['requests 4', 'whisper stop 4 true', 'apple stop 4 true']);
});
