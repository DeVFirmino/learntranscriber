const HEADER = 44;

// Wraps mono 16 kHz PCM16 samples in a WAV header. A native capture segment is at most 16 s; callers with longer
// audio pass their own bound.
function wav(samples, maxBytes = 512000) {
  if (samples.length % 2 || samples.length > maxBytes) throw new Error('Invalid native audio segment.');
  const header = Buffer.alloc(HEADER);
  header.write('RIFF');
  header.writeUInt32LE(36 + samples.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(samples.length, 40);
  return Buffer.concat([header, samples]);
}

// The PCM samples of a WAV segment built by wav(); any other layout is refused.
function wavSamples(bytes) {
  if (!(bytes instanceof ArrayBuffer) || bytes.byteLength < HEADER) throw new Error('Invalid native audio packet.');
  const header = Buffer.from(bytes, 0, HEADER);
  if (
    header.toString('ascii', 0, 4) !== 'RIFF' ||
    header.toString('ascii', 8, 12) !== 'WAVE' ||
    header.toString('ascii', 36, 40) !== 'data' ||
    header.readUInt16LE(22) !== 1 ||
    header.readUInt32LE(24) !== 16000 ||
    header.readUInt16LE(34) !== 16 ||
    header.readUInt32LE(40) !== bytes.byteLength - HEADER
  )
    throw new Error('Invalid native audio packet.');
  return bytes.slice(HEADER);
}

// A base64 PCM packet from the native capture helper, as a WAV segment.
function packetWav(samples) {
  if (typeof samples !== 'string' || !samples.length || !/^[A-Za-z0-9+/=]+$/.test(samples))
    throw new Error('Invalid audio encoding.');
  return wav(Buffer.from(samples, 'base64'));
}

module.exports = { wav, wavSamples, packetWav };
