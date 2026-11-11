// Every live transcription engine publishes its captions the same way: the user's own speech is noted, every
// window gets the caption, and a final caption with text was saved to the transcript, so the state changed.
function createCaptionPublisher({ speech, broadcast, changed }) {
  return (caption) => {
    speech.heard(caption);
    broadcast('live:caption', caption);
    if (caption.final && caption.text) changed();
  };
}
module.exports = { createCaptionPublisher };
