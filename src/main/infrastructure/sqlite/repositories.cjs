const { transaction } = require('./database.cjs');
const { settingsRepository } = require('./settings.cjs');
const { credentialRepository } = require('./credentials.cjs');
const { assistantRepository, seedBuiltInAssistants } = require('./assistants.cjs');
const { compactionRepository } = require('./compactions.cjs');
const { transcriptMemoryRepository } = require('./transcript-memory.cjs');
const { sessionRepository } = require('./sessions.cjs');
const { sessionSearch } = require('./session-search.cjs');
const { historyMaintenance } = require('./history-maintenance.cjs');
const { entryRepository } = require('./entries.cjs');
const { contextItemRepository } = require('./context-items.cjs');

// Builds every repository over one open connection, in dependency order, for the composition root and tests.
// Modules receive only the repositories they use, never this whole set. The platform picks the settings defaults
// and the shortcut collision rules.
function createRepositories(db, { platform } = {}) {
  seedBuiltInAssistants(db);
  const connection = { db, transaction };
  const settings = settingsRepository({ ...connection, platform });
  const assistants = assistantRepository({ ...connection, settings });
  const compactions = compactionRepository(connection);
  const sessions = sessionRepository({ db, settings, compactions });
  const contextItems = contextItemRepository({ db, sessions });
  return {
    db,
    settings,
    credentials: credentialRepository(connection),
    assistants,
    compactions,
    transcriptMemory: transcriptMemoryRepository(connection),
    sessions,
    sessionSearch: sessionSearch(connection),
    history: historyMaintenance(connection),
    entries: entryRepository({ db, sessions }),
    contextItems,
  };
}
module.exports = { createRepositories };
