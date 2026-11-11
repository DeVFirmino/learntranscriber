// System-audio chunks count only for the live session: Apple speech transcribes them and the renderers
// receive them. Chunks of any other session are dropped.
function routeSystemAudioChunks({ active, appleSpeech, broadcast }) {
  return (chunk) => {
    if (chunk.sessionId !== active.id()) return;
    appleSpeech()?.pushSystem(chunk);
    broadcast('audio:native-chunk', chunk);
  };
}
module.exports = { routeSystemAudioChunks };
