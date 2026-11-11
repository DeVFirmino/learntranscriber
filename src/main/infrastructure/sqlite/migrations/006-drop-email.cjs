// Email was removed: the SMTP account sealed in the credential vault and the record of sent summaries go.
function up(db) {
  db.exec('DROP TABLE IF EXISTS email_deliveries');
  db.prepare("DELETE FROM credentials WHERE provider='smtp'").run();
}

module.exports = { version: 6, name: 'drop-email', up };
