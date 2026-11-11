const { routeSystemAudioChunks } = require('../application/audio/system-audio-chunks.cjs');
const { nativeHelperPaths } = require('../infrastructure/electron/native-helper-paths.cjs');
const { NativeContext } = require('../infrastructure/native/context-helper.cjs');
const { NativeSpeech } = require('../infrastructure/native/speech-helper.cjs');
const { SystemAudio } = require('../infrastructure/native/system-audio.cjs');
const { appleLocaleUsage } = require('../infrastructure/sqlite/apple-locale-usage.cjs');

// The Swift helpers: Apple speech, which remembers the locales it used in the workspace, the desktop context, and
// incoming audio. The audio helper's chunks go to the live session; its exits and route changes reach the output
// leases, which the audio controllers create at start.
function composeNative({ paths, db, active, appleSpeech, broadcast, outputLeases }) {
  const helper = nativeHelperPaths(paths);
  const speech = new NativeSpeech(helper('apple-speech'), undefined, {
    usage: {
      read: () => appleLocaleUsage(db()).read(),
      write: (value) => appleLocaleUsage(db()).write(value),
    },
  });
  const context = new NativeContext(helper('context-helper'));
  const systemAudio = new SystemAudio(
    helper('system-audio'),
    routeSystemAudioChunks({ active, appleSpeech, broadcast }),
    (message) => broadcast('audio:native-error', message),
    {
      onExit: ({ unexpected }) => unexpected && outputLeases().ended('The incoming audio helper stopped.'),
      onRoute: (change) => outputLeases().route(change),
    },
  );
  return { speech, context, systemAudio };
}
module.exports = { composeNative };
