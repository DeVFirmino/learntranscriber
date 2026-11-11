const { shortcutConfig } = require('../../domain/settings/shortcuts.cjs');

// Registers the configured global shortcuts with Electron; suspension (settings open) and the Escape key re-register.
class ShortcutRegistry {
  constructor(api, dispatch, onChange = () => {}, platform) {
    this.api = api;
    this.platform = platform;
    this.dispatch = dispatch;
    this.onChange = onChange;
    this.owned = [];
    this.status = {};
    this.items = [];
    this.suspended = false;
    this.raw = '{}';
    this.escapeEnabled = false;
  }
  configure(raw) {
    const items = shortcutConfig(raw, this.platform);
    this.raw = raw;
    this.close();
    this.status = {};
    this.items = items;
    for (const item of items) {
      let ok = false;
      if (item.enabled && !this.suspended) {
        try {
          ok = this.api.register(item.accelerator, () => {
            if (!this.suspended) this.dispatch(item.id);
          });
        } catch {}
        if (ok) this.owned.push(item.accelerator);
      }
      this.status[item.id] = ok;
    }
    if (this.escapeEnabled && !this.suspended) {
      let ok = false;
      try {
        ok = this.api.register('Escape', () => {
          if (this.escapeEnabled && !this.suspended) this.dispatch('escape');
        });
      } catch {}
      if (ok) this.owned.push('Escape');
    }
    this.onChange(this.status);
    return this.items.map((item) => ({ ...item, registered: this.status[item.id] }));
  }
  setSuspended(suspended) {
    if (this.suspended === suspended) return;
    this.suspended = suspended;
    this.configure(this.raw);
  }
  setEscapeEnabled(enabled) {
    if (this.escapeEnabled === enabled) return;
    this.escapeEnabled = enabled;
    this.configure(this.raw);
  }
  close() {
    for (const accelerator of this.owned) this.api.unregister(accelerator);
    this.owned = [];
  }
}
module.exports = { ShortcutRegistry };
