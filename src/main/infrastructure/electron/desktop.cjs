const { externalResponseUrl } = require('../../domain/shared/response-links.cjs');
const { requestImages, MAX_IMAGE_BYTES } = require('../../domain/sessions/images.cjs');

// The System Settings privacy panes the Permissions tab may open; nothing else is accepted.
const PRIVACY_PANES = {
  microphone: 'Privacy_Microphone',
  screen: 'Privacy_ScreenCapture',
  accessibility: 'Privacy_Accessibility',
  speech: 'Privacy_SpeechRecognition',
};

// Clipboard, links and system prompts the renderer may use. Links open only after the response-link check.
function electronDesktop({ clipboard, nativeImage, shell, systemPreferences, app }) {
  return {
    accessibilityPermission: () => systemPreferences.isTrustedAccessibilityClient(true),
    // Read without prompting, for the Permissions tab.
    permissions: () => ({
      microphone: systemPreferences.getMediaAccessStatus('microphone'),
      screen: systemPreferences.getMediaAccessStatus('screen'),
      accessibility: systemPreferences.isTrustedAccessibilityClient(false),
    }),
    readText: async () => (await clipboard.readText()).slice(0, 100000),
    writeResponse(value) {
      if (typeof value !== 'string' || value.length > 100000) throw new Error('Code is too large to copy.');
      return Promise.resolve(clipboard.writeText(value)).then(() => true);
    },
    openLink: (url) => shell.openExternal(externalResponseUrl(url)),
    async readImage() {
      for (const item of await clipboard.read()) {
        const type = ['image/png', 'image/jpeg'].find((mime) => item.types.includes(mime));
        if (!type) continue;
        const blob = await item.getType(type);
        if (blob.size > MAX_IMAGE_BYTES) throw new Error('A screenshot exceeds the 8 MB limit.');
        const bytes = Buffer.from(await blob.arrayBuffer());
        const png = type === 'image/png' ? bytes : nativeImage.createFromBuffer(bytes).toPNG();
        return requestImages({ image: `data:image/png;base64,${png.toString('base64')}` })[0];
      }
      return null;
    },
    openSharingHelp: () =>
      shell.openExternal(
        'https://support.apple.com/guide/mac-help/control-access-screen-system-audio-recording-mchld6aa7d23/mac',
      ),
    requestMicrophone: () => systemPreferences.askForMediaAccess('microphone'),
    version: () => app.getVersion(),
    // Restarting is the only way out of a refused Keychain read; the ordered quit flushes recordings first.
    relaunch() {
      app.relaunch();
      app.quit();
    },
    openPrivacyPane(name) {
      const pane = PRIVACY_PANES[name];
      if (!pane) throw new Error('Unknown privacy setting.');
      return shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${pane}`);
    },
  };
}
module.exports = { electronDesktop };
