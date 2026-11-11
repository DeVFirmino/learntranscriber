const { createDictation } = require('../application/audio/dictate.cjs');
const { registerMemory } = require('../interface/ipc/memory.cjs');

// Wires dictation to its IPC channel.
function composeMemory({ handle, repositories, requests, transcribe }) {
  registerMemory(handle, {
    requests,
    dictation: createDictation({ settings: () => repositories.settings.read(), transcribe }),
  });
}
module.exports = { composeMemory };
