// Connections were removed: MCP connectors with their secrets and document references, agent handoffs, Obsidian
// summary deliveries and the assistants' tool fields go, with the settings that only they read.
const TABLES = [
  'document_references',
  'connector_secrets',
  'connector_oauth',
  'connectors',
  'handoffs',
  'summary_deliveries',
];
const ASSISTANT_COLUMNS = [
  'mcp_determination_prompt',
  'mcp_interpretation_prompt',
  'mcp_next_action_prompt',
  'mcp_servers',
];
const SETTINGS = [
  'assistantTools',
  'autoReadOnlyTools',
  'handoffEnabled',
  'handoffHistoryAccess',
  'globalMcpDeterminationPrompt',
  'globalMcpInterpretationPrompt',
  'globalMcpNextActionPrompt',
];

function up(db) {
  for (const table of TABLES) db.exec(`DROP TABLE IF EXISTS ${table}`);
  // A workspace shaped before the tool columns were added never had them.
  const present = new Set(
    db
      .prepare('PRAGMA table_info(assistants)')
      .all()
      .map((column) => column.name),
  );
  for (const column of ASSISTANT_COLUMNS.filter((name) => present.has(name)))
    db.exec(`ALTER TABLE assistants DROP COLUMN ${column}`);
  const remove = db.prepare('DELETE FROM settings WHERE key=?');
  for (const key of SETTINGS) remove.run(key);
}

module.exports = { version: 5, name: 'drop-connections', up };
