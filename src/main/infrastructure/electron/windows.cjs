const { barRows, barRowsHeight } = require('../../domain/overlay/bar-rows.cjs');
const {
  COLLAPSED_HEIGHT,
  BAR_POPOVER_HEIGHT,
  resizedPanel,
  nudged,
  insideArea,
} = require('../../domain/windows/layout.cjs');
const { createRendererRecovery } = require('./renderer-recovery.cjs');
const { createSettingsRoute } = require('./settings-route.cjs');
const { createNotchWindow } = require('./notch-lifecycle.cjs');
const { createWindowFactory } = require('./window-factory.cjs');

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
    onboarding = false,
    onboardingPanelBounds = null,
    // The expanded floating assistant keeps the height the user resized it to; the collapsed bar stays compact.
    expandedHeight = 428,
    // Whether the workspace is listening, and since when; the floating bar shows it as a timer.
    listening = { active: false, starting: false, since: null },
    // The prompt and transcript preview rows the bar shows above its controls while the panel is collapsed.
    rows = { prompt: false, preview: false, guide: false },
    barPopoverOpen = false;
  const settingsRoute = createSettingsRoute({ renderer, onChange: onSettingsOpen });
  const open = (window) => Boolean(window && !window.isDestroyed());
  const barHeight = () => COLLAPSED_HEIGHT + barRowsHeight(rows) + (barPopoverOpen ? BAR_POPOVER_HEIGHT : 0);
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
    sizes: () => ({ expandedHeight, barHeight: barHeight() }),
    notchShowsAtStart: () => !onboarding && settings().notchEnabled && active.id() && notchState.expanded(),
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
    barRows: () => ({ ...rows }),
    // Shows the bar's session rows while a session runs with the panel collapsed. The bar window grows or shrinks
    // upward, so its controls, bottom edge, position and width stay where they are. Nothing changes while every
    // window is concealed, so restoring does not flash the rows.
    setBarPopoverOpen(open) {
      barPopoverOpen = open;
      this.syncBar();
    },
    syncBar() {
      if (privacy().concealed) return;
      rows = barRows({
        hasActiveSession: Boolean(active.id()),
        sessionSurfaceVisible: overlayExpanded,
        capturing: listening.active || listening.starting,
        guiding: Boolean(settings().onboardingGuide),
      });
      if (!open(bar)) return;
      const current = bar.getBounds(),
        height = barHeight();
      if (current.height !== height)
        bar.setBounds({ x: current.x, y: current.y + current.height - height, width: current.width, height });
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
      if (privacy().concealed || onboarding) return;
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
      if (onboarding) return;
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
    // Resizes only the independent session panel, preserving its current bottom edge.
    resizeOverlay(_caller, width, height) {
      const window = overlay;
      if (!open(window)) return;
      const area = screen.getDisplayMatching(window.getBounds()).workArea;
      const next = resizedPanel(window.getBounds(), area, width, height);
      window.setBounds(next);
      if (overlayExpanded) expandedHeight = next.height;
    },
    setOverlayExpanded(_caller, expanded) {
      overlayExpanded = expanded;
      if (!open(overlay)) overlay = create('overlay');
      if (expanded) privacy().show(overlay, false);
      else overlay.hide();
      changed();
    },
    setNotchExpanded: (expanded) => {
      if (!onboarding) notchWindow.setExpanded(expanded);
    },
    syncNotch: () => {
      if (onboarding) {
        const notch = notchWindow.window();
        if (open(notch)) privacy().hide(notch);
        return;
      }
      notchWindow.sync();
    },
    presentOnboarding(caller, active) {
      if (active && !onboarding && open(overlay)) onboardingPanelBounds = overlay.getBounds();
      onboarding = active;
      if (active) {
        if (open(bar)) privacy().hide(bar);
        const notch = notchWindow.window();
        if (open(notch)) privacy().hide(notch);
        if (open(overlay)) {
          // The workspace also asks while it starts hidden behind the floating bar; only a workspace the person can see
          // takes the onboarding from the panel.
          if (caller === main) {
            if (main.isVisible()) privacy().hide(overlay);
          } else {
            // On a first launch the panel exists but has never been shown, and the bar just went away: show it, or
            // nothing of the app is on screen.
            this.resizeOverlay(overlay, 640, 680);
            privacy().show(overlay, false);
          }
        }
      } else if (onboardingPanelBounds && open(overlay)) {
        overlay.setBounds(onboardingPanelBounds);
        onboardingPanelBounds = null;
      }
      changed();
    },
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
