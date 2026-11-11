const { DEFINITIONS, shortcutConfig } = require('../../domain/settings/shortcuts.cjs');

// Each configured shortcut with whether it registered and its defaults, so the settings editor can mark custom
// keys and offer Reset.
function shortcutDefinitions(saved, status, platform) {
  return shortcutConfig(saved, platform).map((item) => {
    const base = DEFINITIONS.find((definition) => definition.id === item.id);
    return {
      ...item,
      registered: Boolean(status[item.id]),
      defaultAccelerator: base.accelerator,
      defaultEnabled: base.enabled,
    };
  });
}
module.exports = { shortcutDefinitions };
