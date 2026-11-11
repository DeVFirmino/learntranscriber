const { createSystemAudioCapture } = require('../application/audio/system-audio.cjs');
const { createOutputLeases } = require('../application/audio/output-leases.cjs');
const { driverStatus } = require('../application/audio/driver-status.cjs');
const { createLiveSessions } = require('../application/audio/live-session.cjs');
const { createSegmentTranscription } = require('../application/audio/transcribe.cjs');
const { createSpeechAssets } = require('../application/audio/speech-assets.cjs');
const { registerAudio } = require('../interface/ipc/audio.cjs');

// Wires system-audio capture, live transcription and recorded segments to their IPC channels. Returns the system-audio output leases that sessions release when they end.
function composeAudio({
  handle,
  active,
  settings,
  entries,
  systemAudio,
  engines,
  jobs,
  nativeSpeech,
  transcribe,
  broadcast,
  changed,
}) {
  const capture = createSystemAudioCapture({ active, settings, systemAudio });
  const leases = createOutputLeases({ capture, onState: (state) => broadcast('audio:output-state', state) });
  registerAudio(handle, {
    onError: (message) => broadcast('integration:error', message),
    systemAudio: capture,
    leases,
    driver: (devices) =>
      driverStatus({ platform: process.platform, systemVersion: process.getSystemVersion?.(), devices }),
    live: createLiveSessions({
      active,
      settings,
      apple: engines.apple,
      whisper: engines.whisper,
      realtime: engines.realtime,
      gemini: engines.gemini,
    }),
    segments: createSegmentTranscription({
      active,
      jobs,
      settings,
      timeout: () => AbortSignal.timeout(90000),
      changed,
      transcripts: {
        segment: (sessionId, segmentId) => entries.segment(sessionId, segmentId),
        add: (sessionId, content, speaker, segmentId) =>
          entries.add(sessionId, 'transcript', content, speaker, segmentId),
      },
      transcribe,
    }),
    speech: createSpeechAssets({ active, settings, nativeSpeech }),
  });
  return leases;
}
module.exports = { composeAudio };
