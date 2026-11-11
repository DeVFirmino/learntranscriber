// Whether the user is speaking in a live session right now, from the latest caption of their own microphone.
function createLiveSpeech() {
  let latest = null;
  return {
    heard(caption) {
      if (caption?.speaker !== 'ME') return;
      latest = {
        sessionId: caption.sessionId,
        speaking: !caption.final && !caption.error && Boolean(caption.text?.trim()),
      };
    },
    speaking: (sessionId) => Boolean(latest?.speaking && latest.sessionId === sessionId),
  };
}
module.exports = { createLiveSpeech };
