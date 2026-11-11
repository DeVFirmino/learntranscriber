// Built-in assistants the user deleted; the seed that runs after migrations does not bring them back.
function up(db) {
  db.exec('CREATE TABLE IF NOT EXISTS dismissed_built_ins (id TEXT PRIMARY KEY)');
}

module.exports = { version: 3, name: 'dismissed-built-ins', up };
