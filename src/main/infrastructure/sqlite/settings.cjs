const { DEFAULT_MODELS, defaultsFor } = require('../../domain/settings/defaults.cjs');
const { validateSettings } = require('../../domain/settings/validate.cjs');

function settingsRepository({ db, transaction, platform }) {
  const defaults = defaultsFor(platform);
  function read() {
    const values = { ...defaults };
    let savedModel = false;
    for (const row of db.prepare('SELECT key,value FROM settings').all()) {
      if (Object.hasOwn(defaults, row.key)) values[row.key] = JSON.parse(row.value);
      if (row.key === 'model') savedModel = true;
    }
    // Until a model is saved, the provider's packaged default stands in; a saved model, even empty, is kept.
    if (!savedModel) values.model = DEFAULT_MODELS[values.provider] || '';
    return values;
  }
  return {
    read,
    // The whole patch is validated before anything is written, then written in one transaction.
    update(patch) {
      const validated = validateSettings(patch, platform);
      transaction(db, () => {
        const statement = db.prepare('INSERT OR REPLACE INTO settings VALUES (?, ?)');
        for (const [key, value] of Object.entries(validated)) statement.run(key, JSON.stringify(value));
      });
      return read();
    },
  };
}
module.exports = { settingsRepository };
