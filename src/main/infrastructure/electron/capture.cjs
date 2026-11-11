// Screen capture of the display chosen in settings, falling back to the primary display.
function displayCapture({ desktopCapturer, screen, settings }) {
  const preferred = () => settings().displayId || String(screen.getPrimaryDisplay().id);
  return {
    async thumbnail() {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 2400, height: 1600 },
      });
      const source = sources.find((s) => s.display_id === preferred());
      if (!source || source.thumbnail.isEmpty())
        throw new Error(
          'Screen capture unavailable. Choose a connected display and grant Screen Recording permission.',
        );
      return source.thumbnail;
    },
    async mediaSource() {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
      return sources.find((s) => s.display_id === preferred()) || null;
    },
    screens: () => screen.getAllDisplays().map((d) => ({ id: String(d.id), label: d.label || `Display ${d.id}` })),
  };
}
module.exports = { displayCapture };
