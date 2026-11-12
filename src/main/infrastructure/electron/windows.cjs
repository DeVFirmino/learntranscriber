const { resizedPanel, nudged, insideArea } = require('../../domain/windows/layout.cjs');
const { createBarSize } = require('./bar-size.cjs');
const { createRendererRecovery } = require('./renderer-recovery.cjs');
const { createSettingsRoute } = require('./settings-route.cjs');
const { createNotchWindow } = require('./notch-lifecycle.cjs');
const { createWindowFactory } = require('./window-factory.cjs');
const { createOnboardingPresentation } = require('./onboarding-presentation.cjs');

// The workspace, independent session panel, fixed recording bar and optional Notch. Windows hide instead of
// closing until quit.
function createWindows({
  BrowserWindow,
  screen,
  privacy,
  settings,
  active,
  notchState,
  renderer,
  preload,
  platform,
  isQuitting,
  onOwnerDestroyed,
  changed,
  onSettingsOpen = () => {},
  recovery = createRendererRecovery(),
}) {
  let main = null,
    overlay = null,
    bar = null,
    overlayExpanded = false,
    // The expanded floating assistant keeps the height the user resized it to; the collapsed bar stays compact.
    expandedHeight = 428,
    // Whether the workspace is listening, and since when; the floating bar shows it as a timer.
    listening = { active: false, starting: false, since: null };
  const settingsRoute = createSettingsRoute({ renderer, onChange: onSettingsOpen });
  const open = (window) => Boolean(window && !window.isDestroyed());
  const barSize = createBarSize({ privacy, settings, active });
  const surfaceColor = (role) =>
    (role === 'overlay' || role === 'notch') && settings().surfaceTheme === 'light' ? '#ffffff' : '#121212';

  const create = createWindowFactory({
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
    sizes: () => ({ expandedHeight, barHeight: barSize.height() }),
    notchShowsAtStart: () => !onboarding.active() && settings().notchEnabled && active.id() && notchState.expanded(),
    events: {
      rendererGone(role) {
        if (role === 'main' && (listening.active || listening.starting)) {
          listening = { active: false, starting: false, since: null };
          changed();
        }
      },
      // A closed panel is a collapsed panel, so the bar offers to expand it again and shows its session rows.
      closed(window) {
        if (window === overlay && overlayExpanded) {
          overlayExpanded = false;
          changed();
        }
        if (window === bar) changed();
      },
      panelResized(height) {
        if (overlayExpanded) expandedHeight = height;
      },
    },
  });

  const notchWindow = createNotchWindow({ create, open, screen, settings, active, notchState, privacy, changed });
  // Resizes only the independent session panel, preserving its current bottom edge.
  function resizePanel(width, height) {
    if (!open(overlay)) return;
    const area = screen.getDisplayMatching(overlay.getBounds()).workArea;
    const next = resizedPanel(overlay.getBounds(), area, width, height);
    overlay.setBounds(next);
    if (overlayExpanded) expandedHeight = next.height;
  }
  const onboarding = createOnboardingPresentation({
    privacy,
    open,
    notch: () => notchWindow.window(),
    windows: () => ({ main, overlay, bar }),
    resizePanel,
    changed,
  });

  return {
    // GPU process exits are only logged; nothing else recovers from them.
    childGone: (details) => recovery.childGone(details),
    main: () => main,
    overlay: () => overlay,
    bar: () => bar,
    barVisible: () => open(bar) && bar.isVisible() && !privacy().concealed,
    fadePanel(opacity) {
      if (open(overlay)) overlay.setOpacity(opacity === null ? 1 : opacity);
    },
    notch: () => notchWindow.window(),
    open,
    surfaceColor,
    overlayExpanded: () => overlayExpanded,
    listening: () => ({ ...listening }),
    barRows: () => barSize.rows(),
    // Shows the bar's session rows while a session runs with the panel collapsed, and room for an open popover.
    setBarPopoverOpen(open) {
      barSize.setPopoverOpen(open);
      this.syncBar();
    },
    syncBar() {
      barSize.sync(open(bar) ? bar : null, {
        panelExpanded: overlayExpanded,
        capturing: listening.active || listening.starting,
      });
    },
    // Starting to listen opens the floating panel on its transcript.
    setListening(active, starting = false, paused = false) {
      if (active === listening.active && starting === listening.starting && paused === Boolean(listening.paused))
        return;
      const began = active && !listening.active;
      listening = { active, starting, paused, since: active ? listening.since || Date.now() : null };
      if (began && open(overlay) && !overlayExpanded) this.setOverlayExpanded(overlay, true);
      changed();
    },
    // The workspace window always exists, since it owns recording, but may start hidden behind the floating bar.
    openMain({ show = true } = {}) {
      main = create('main', { show });
      return main;
    },
    // A destroyed workspace window comes back hidden, so recording and the bar's actions never lose their owner.
    ensureMain() {
      if (!open(main)) main = create('main', { show: false });
      return main;
    },
    showOverlay() {
      if (privacy().concealed || onboarding.active()) return;
      if (!open(overlay)) overlay = create('overlay');
      if (!open(bar)) bar = create('overlay', { surface: 'bar' });
      privacy().show(bar, false);
      if (overlayExpanded) privacy().show(overlay, false);
      changed();
    },
    showMain() {
      if (privacy().concealed) privacy().restore();
      if (!open(main)) main = create('main');
      else privacy().show(main);
      changed();
    },
    toggleOverlay() {
      if (onboarding.active()) return;
      // While everything is hidden the toggle only changes whether the floating assistant returns on restore;
      // nothing is revealed.
      if (privacy().concealed) {
        if (open(bar) && privacy().willRestore(bar)) {
          privacy().setRestore(bar, false);
          if (open(overlay)) privacy().setRestore(overlay, false);
        } else {
          if (!open(bar)) bar = create('overlay', { surface: 'bar' });
          privacy().setRestore(bar, true);
          if (overlayExpanded) {
            if (!open(overlay)) overlay = create('overlay');
            privacy().setRestore(overlay, true);
          }
        }
        changed();
        return;
      }
      if (open(bar) && bar.isVisible()) {
        bar.hide();
        if (open(overlay)) overlay.hide();
      } else this.showOverlay();
      changed();
    },
    resizeOverlay: (_caller, width, height) => resizePanel(width, height),
    setOverlayExpanded(_caller, expanded) {
      overlayExpanded = expanded;
      if (!open(overlay)) overlay = create('overlay');
      if (expanded) privacy().show(overlay, false);
      else overlay.hide();
      changed();
    },
    setNotchExpanded: (expanded) => {
      if (!onboarding.active()) notchWindow.setExpanded(expanded);
    },
    syncNotch: () => {
      if (onboarding.active()) {
        const notch = notchWindow.window();
        if (open(notch)) privacy().hide(notch);
        return;
      }
      notchWindow.sync();
    },
    presentOnboarding: (caller, next) => onboarding.present(caller, next),
    // The session panel is shown: expanded, visible and not concealed.
    panelVisible: () => overlayExpanded && open(overlay) && overlay.isVisible() && !privacy().concealed,
    // Slides only the session panel by a step, keeping it inside its display; the recording bar stays fixed.
    nudgePanel(dx, dy) {
      if (!open(overlay)) return;
      const bounds = overlay.getBounds();
      const next = nudged(bounds, screen.getDisplayMatching(bounds).workArea, dx, dy);
      overlay.setPosition(next.x, next.y);
    },
    // Pulls every window back inside a display after monitors change.
    recoverBounds() {
      for (const window of privacy().windows.keys())
        if (!window.isDestroyed()) {
          const bounds = window.getBounds();
          window.setBounds(insideArea(bounds, screen.getDisplayMatching(bounds).workArea));
        }
    },
    create,
  };
}
module.exports = { createWindows };
