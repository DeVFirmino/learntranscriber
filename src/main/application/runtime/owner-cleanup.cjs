// What ends with a window: once it is destroyed, its owner-bound requests are cancelled and its live transcription is
// stopped. The engines are read when needed, since they are created after the windows.
function createOwnerCleanup({ requests, transcribers }) {
  return {
    destroyed(ownerId) {
      requests.cancelOwner(ownerId);
      for (const transcriber of transcribers()) void transcriber?.stop(ownerId, true);
    },
  };
}
module.exports = { createOwnerCleanup };
