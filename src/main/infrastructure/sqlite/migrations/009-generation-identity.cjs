// Older entries have no reliable generation identity; preserve them without guessing from adjacency.
function up(db) {
  const columns = new Set(
    db
      .prepare('PRAGMA table_info(entries)')
      .all()
      .map((column) => column.name),
  );
  for (const name of ['generation_mode', 'request_id'])
    if (!columns.has(name)) db.exec(`ALTER TABLE entries ADD COLUMN ${name} TEXT`);
}
module.exports = { version: 9, name: 'generation-identity', up };
