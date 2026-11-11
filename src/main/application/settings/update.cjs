const { changesSessionModel } = require('../../domain/sessions/rules.cjs');
const { appKeptKey } = require('../../domain/settings/app-kept.cjs');

// A save never names a setting the app keeps for itself. The rest are validated and saved first; the effects then run
// in a fixed order and the state is published once.
function createSettingsUpdate({ settings, active, sessions, metadata, effects, changed, publicState }) {
  return {
    save(patch) {
      const kept = appKeptKey(patch);
      if (kept) throw new Error(`Setting ${kept} is kept by the app.`);
      const saved = settings.update(patch),
        has = (key) => Object.hasOwn(patch, key);
      if (active.id() && changesSessionModel(patch)) sessions.updateModel(active.id(), metadata(saved));
      effects.privacy(saved);
      if (has('shortcuts')) effects.shortcuts(saved.shortcuts);
      if (!saved.autoSelection || !saved.autoScreenInsights || has('displayId')) effects.cancelScreenInsights();
      if (has('surfaceTheme')) effects.surfaceTheme();
      changed();
      return publicState();
    },
  };
}
module.exports = { createSettingsUpdate };
