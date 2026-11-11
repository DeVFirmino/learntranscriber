const { DEFINITIONS } = require('../../domain/settings/shortcuts.cjs');

const SHORTCUTS = Object.freeze(
  Object.fromEntries(
    ['hide', 'overlay', 'clickThrough'].map((id) => [id, DEFINITIONS.find((d) => d.id === id).accelerator]),
  ),
);

// Applies capture protection, Dock and taskbar hiding, floating-window behaviour and concealment to every window.
class PrivacyController {
  constructor(app, settings, platform) {
    this.app = app;
    this.settings = settings;
    this.platform = platform;
    this.windows = new Map();
    this.concealed = false;
    this.restoreTargets = new Set();
    this.notchInteractive = new WeakSet();
    this.dockHidden = undefined;
    this.dockTimer = null;
    this.dockUpdating = false;
    this.dockShowAt = 0;
    this.applying = new WeakSet();
  }
  register(window, role) {
    this.windows.set(window, role);
    this.apply(window, role);
    window.on?.('page-title-updated', (event) => {
      event.preventDefault();
      this.apply(window, role);
    });
    for (const event of ['show', 'restore', 'focus'])
      window.on?.(event, () => {
        if (!window.isDestroyed()) this.apply(window, role);
      });
    if (role === 'notch')
      window.on?.('hide', () => {
        this.notchInteractive.delete(window);
        if (!window.isDestroyed()) this.apply(window, role);
      });
    window.once('closed', () => {
      this.windows.delete(window);
      this.restoreTargets.delete(window);
    });
  }
  update(settings) {
    this.settings = settings;
    for (const [window, role] of this.windows) if (!window.isDestroyed()) this.apply(window, role);
    this.scheduleDock();
  }
  scheduleDock() {
    if (
      this.platform !== 'darwin' ||
      !this.app.dock ||
      this.dockUpdating ||
      this.dockTimer !== null ||
      this.dockHidden === this.hideDock
    )
      return;
    // AppKit activation changes must run outside the synchronous renderer IPC/settings stack. Electron's Dock
    // implementation also handles foreground activation asynchronously when restoring an accessory app.
    const delay = this.hideDock ? Math.max(0, this.dockShowAt + 1_000 - Date.now()) : 0;
    this.dockTimer = setTimeout(() => {
      this.dockTimer = null;
      void this.syncDock();
    }, delay);
  }
  async syncDock() {
    const hidden = this.hideDock;
    this.dockUpdating = true;
    this.dockHidden = hidden;
    try {
      if (hidden) {
        this.app.dock.hide();
        this.confirmDockHidden();
      } else if (this.app.dock.isVisible?.() !== true) {
        this.dockShowAt = Date.now();
        // dock.show() settles only once the app activates, which macOS refuses while another app is in front; a
        // later change must not wait on it, so the wait is bounded.
        await Promise.race([this.app.dock.show(), new Promise((resolve) => setTimeout(resolve, 1_000))]);
      }
    } catch (error) {
      this.dockHidden = undefined;
      console.error('Could not update Dock visibility:', error.message);
    } finally {
      this.dockUpdating = false;
      // A newer setting wins even when it arrives while dock.show() is pending. Electron ignores dock.hide()
      // for one second after dock.show(), so scheduleDock observes that interval before trying to hide again.
      if (this.dockHidden !== undefined) this.scheduleDock();
    }
  }
  // AppKit ignores a hide while an earlier show is still settling, so the hide is repeated until the icon is gone.
  confirmDockHidden(attempt = 0) {
    if (attempt >= 8 || typeof this.app.dock.isVisible !== 'function') return;
    setTimeout(() => {
      if (!this.hideDock || this.dockHidden !== true || !this.app.dock.isVisible()) return;
      this.app.dock.hide();
      this.confirmDockHidden(attempt + 1);
    }, 250);
  }
  get hideDock() {
    return Boolean(this.settings.stealthMode || this.settings.hideDock);
  }
  get protected() {
    return Boolean(this.settings.stealthMode || this.settings.captureProtection);
  }
  apply(window, role) {
    if (this.applying.has(window)) return;
    this.applying.add(window);
    try {
      window.setContentProtection(this.protected);
      window.setSkipTaskbar(this.hideDock);
      window.setTitle(this.hideDock ? '' : role === 'overlay' ? 'LearnTranscriber assistant' : 'LearnTranscriber');
      if (role === 'overlay' || role === 'notch') {
        window.setAlwaysOnTop(this.settings.overlayOnTop, 'floating');
        window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
        window.setOpacity(role === 'notch' ? this.settings.notchOpacity : 1);
        window.setIgnoreMouseEvents(
          role === 'notch' ? !this.notchInteractive.has(window) : this.settings.overlayClickThrough,
          { forward: true },
        );
      }
    } finally {
      this.applying.delete(window);
    }
  }

  setNotchInteractive(window, active) {
    if (this.windows.get(window) !== 'notch' || window.isDestroyed() || this.concealed || !window.isVisible())
      return false;
    if (active) this.notchInteractive.add(window);
    else this.notchInteractive.delete(window);
    window.setIgnoreMouseEvents(!active, { forward: true });
    return true;
  }
  show(window, focus = true) {
    if (window.isDestroyed() || this.concealed) return false;
    this.apply(window, this.windows.get(window));
    if (focus) {
      window.show();
      window.focus();
    } else window.showInactive();
    return true;
  }
  hide(window) {
    if (window.isDestroyed()) return;
    this.notchInteractive.delete(window);
    if (this.windows.get(window) === 'notch') window.setIgnoreMouseEvents(true, { forward: true });
    window.hide();
  }
  conceal() {
    if (this.concealed) return;
    this.concealed = true;
    this.restoreTargets.clear();
    for (const window of this.windows.keys()) {
      if (!window.isDestroyed() && window.isVisible()) {
        this.restoreTargets.add(window);
        this.hide(window);
      }
    }
  }
  restore() {
    this.concealed = false;
    for (const window of this.restoreTargets)
      if (!window.isDestroyed()) {
        this.apply(window, this.windows.get(window));
        window.showInactive();
      }
    this.restoreTargets.clear();
  }
  // Whether a window returns when concealment ends; the floating-assistant toggle edits this while concealed.
  willRestore(window) {
    return this.restoreTargets.has(window);
  }
  setRestore(window, included) {
    if (!this.concealed || window.isDestroyed()) return;
    if (included) this.restoreTargets.add(window);
    else this.restoreTargets.delete(window);
  }
  toggleConcealment() {
    if (this.concealed) this.restore();
    else this.conceal();
  }
  status() {
    return {
      concealed: this.concealed,
      captureProtectionRequested: this.protected,
      stealthMode: Boolean(this.settings.stealthMode),
      dockHidden: this.hideDock,
      platform: this.platform,
      shortcuts: SHORTCUTS,
    };
  }
}
module.exports = { PrivacyController, SHORTCUTS };
