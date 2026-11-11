const { normalizeUsage } = require('../../domain/audio/apple-locale-capacity.cjs');

function appleLocaleUsage(db) {
  const key = 'apple_speech_locale_usage';
  return {
    read() {
      const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
      try {
        return normalizeUsage(row ? JSON.parse(row.value) : {});
      } catch {
        return {};
      }
    },
    write(value) {
      db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)').run(
        key,
        JSON.stringify(normalizeUsage(value)),
      );
    },
  };
}

module.exports = { appleLocaleUsage };
