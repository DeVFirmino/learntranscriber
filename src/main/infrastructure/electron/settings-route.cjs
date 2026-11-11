// Only the shortcut editor suspends global keys. Other settings keep listening, capture and ask available.
// The editor closes when the window hides, reloads,
// crashes or is destroyed, so a lost window never leaves the global shortcuts suspended.
function createSettingsRoute({ renderer, onChange }) {
  let open = false;
  const set = (value) => {
    if (open === value) return;
    open = value;
    onChange(value);
  };
  return {
    watch(window) {
      const routeChanged = (url) => {
        if (url.split('#')[0].split('?')[0] !== renderer.url) return;
        set(/^#settings\/shortcuts(?:\/|$)/.test(new URL(url).hash));
      };
      window.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
        if (isMainFrame) routeChanged(url);
      });
      window.webContents.on('did-navigate', (_event, url) => routeChanged(url));
      window.webContents.on('did-start-loading', () => set(false));
      window.on('hide', () => set(false));
      window.on('show', () => routeChanged(window.webContents.getURL()));
    },
    close: () => set(false),
  };
}
module.exports = { createSettingsRoute };
