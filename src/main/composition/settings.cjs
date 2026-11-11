const { createSettingsUpdate } = require('../application/settings/update.cjs');
const { sessionMetadata } = require('../domain/sessions/rules.cjs');

// Saving settings and what each change sets off. A session's model metadata follows the saved settings and the
// installed local runtimes.
function composeSettings({ repositories, active, localModels, effects, changed, publicState }) {
  const metadata = (settings = repositories().settings.read()) =>
    sessionMetadata(settings, localModels()?.state().runtimes);
  const update = createSettingsUpdate({
    settings: { update: (patch) => repositories().settings.update(patch) },
    active,
    sessions: { updateModel: (id, value) => repositories().sessions.updateModel(id, value) },
    metadata: (settings) => metadata(settings),
    effects: {
      privacy: (settings) => effects.privacy().update(settings),
      shortcuts: (value) => effects.shortcuts()?.configure(value),
      cancelScreenInsights: () => effects.screenInsights.cancel(),
      // The floating assistant is transparent and its pills draw their own theme colours, so nothing to repaint.
      surfaceTheme: () => {},
    },
    changed,
    publicState,
  });
  return { update, metadata };
}
module.exports = { composeSettings };
