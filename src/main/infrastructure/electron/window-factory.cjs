const { windowFrame } = require('../../domain/windows/layout.cjs');
const { guardWindow } = require('./window-guards.cjs');
const { initialNotchBounds } = require('./notch-lifecycle.cjs');

// Builds one app window: its frame for the role, a sandboxed renderer, privacy registration, and the lifecycle every
// window shares. Closing hides it until quit; what a window owned ends with its renderer. The window set keeps the
// state, so this module reports through `events`: the renderer of `role` went away, a window was hidden by closing,
// and the expanded panel was resized.
function createWindowFactory({
  BrowserWindow,
  screen,
  privacy,
  settings,
  renderer,
  preload,
  platform,
  isQuitting,
  onOwnerDestroyed,
  settingsRoute,
  recovery,
  surfaceColor,
  sizes,
  notchShowsAtStart,
  events,
}) {
  return function create(role, { show = true, surface = 'panel' } = {}) {
    const display = screen.getPrimaryDisplay().workArea;
    const isBar = role === 'overlay' && surface === 'bar';
    const isNotch = role === 'notch',
      floating = role === 'overlay' || isNotch;
    const initialNotch = isNotch ? initialNotchBounds(screen, settings(), display) : null;
    const window = new BrowserWindow({
      ...windowFrame({ role, surface, display, notch: initialNotch, ...sizes() }),
      show: false,
      frame: !floating,
      backgroundColor: role === 'overlay' ? '#00000000' : surfaceColor(role),
      ...(isNotch ? { transparent: true, hasShadow: false, roundedCorners: true } : {}),
      ...(role === 'overlay' ? { transparent: true, hasShadow: false } : {}),
      // On macOS the floating assistant is a non-activating panel: focusing it to type a question must not activate
      // the app, which would bring the workspace window forward with it.
      ...(role === 'overlay' && platform === 'darwin' ? { type: 'panel' } : {}),
      title: 'LearnTranscriber',
      // Frameless floating windows use the default style: 'hidden' would bring back the macOS window buttons,
      // which float alone over the transparent floating assistant.
      titleBarStyle: 'default',
      webPreferences: {
        preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
        webSecurity: true,
      },
    });
    privacy().register(window, role);
    guardWindow(window, { renderer, isQuitting });
    const ownerId = window.webContents.id;
    if (role === 'main') settingsRoute.watch(window);
    window.webContents.on('destroyed', () => {
      if (role === 'main') settingsRoute.close();
      onOwnerDestroyed(ownerId);
    });
    // What a crashed renderer owned ended with it: its requests, voice and live captions, and, for the workspace,
    // the recording. The window then reloads when the failure is recoverable.
    window.webContents.on('render-process-gone', (_event, details) => {
      if (role === 'main') settingsRoute.close();
      onOwnerDestroyed(ownerId);
      events.rendererGone(role);
      recovery.rendererGone(window, role, details);
    });
    window.on('close', (event) => {
      if (!isQuitting()) {
        event.preventDefault();
        privacy().hide(window);
        events.closed(window);
      }
    });
    if (role === 'overlay' && !isBar)
      window.on('resized', () => {
        if (!window.isDestroyed()) events.panelResized(window.getBounds().height);
      });
    window.once('ready-to-show', () => {
      if ((!floating && show) || (isNotch && notchShowsAtStart())) privacy().show(window, false);
    });
    const query = new URLSearchParams({ window: role, ...(role === 'overlay' ? { surface } : {}) });
    window.loadURL(`${renderer.url}?${query}`);
    return window;
  };
}

module.exports = { createWindowFactory };
