const SPEAKERS = ['ME', 'THEY'];
const MIMES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];

// A recorded segment: who spoke, up to 20 MB of audio in a supported container, and an optional retry id.
function validateSegment(input) {
  if (!SPEAKERS.includes(input.speaker)) throw new Error('Invalid speaker.');
  if (!(input.bytes instanceof ArrayBuffer) || !input.bytes.byteLength || input.bytes.byteLength > 20000000)
    throw new Error('Audio segment must be between 1 byte and 20 MB.');
  if (!MIMES.includes(input.mime)) throw new Error('Unsupported audio format.');
  if (
    input.segmentId !== undefined &&
    input.segmentId !== null &&
    (typeof input.segmentId !== 'string' || !input.segmentId || input.segmentId.length > 100)
  )
    throw new Error('Invalid audio segment.');
}
module.exports = { validateSegment };
