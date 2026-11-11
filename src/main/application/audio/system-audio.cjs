// Incoming system audio is captured only for the live session and only when the user enabled it. The helper
// captures with ScreenCaptureKit, or with a Core Audio process tap when that route is chosen; a tap that cannot
// start (older macOS, permission, no output device) falls back to ScreenCaptureKit and says so.
const HELPER_ROUTES = ['native', 'process-tap'];

function createSystemAudioCapture({ active, settings, systemAudio }) {
  return {
    status: () => systemAudio.status(),
    devices: () => systemAudio.listDevices(),
    async start(id) {
      const current = settings();
      if (id !== active.id() || !current.systemAudio)
        throw new Error('Enable incoming audio and start this session before listening.');
      if (!HELPER_ROUTES.includes(current.systemAudioSource))
        throw new Error('The selected incoming audio source is captured by the window, not the native helper.');
      if (current.systemAudioSource === 'process-tap')
        try {
          await systemAudio.start(id, current.displayId, current.liveTranscription, { processTap: true });
          return { route: 'process-tap' };
        } catch (error) {
          await systemAudio.start(id, current.displayId, current.liveTranscription);
          return { route: 'native', fellBack: true, reason: String(error.message || error).slice(0, 300) };
        }
      await systemAudio.start(id, current.displayId, current.liveTranscription);
      return { route: 'native' };
    },
    stop: () => systemAudio.stop(),
  };
}
module.exports = { createSystemAudioCapture, HELPER_ROUTES };
