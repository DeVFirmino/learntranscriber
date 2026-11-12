const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const { LocalModels } = require('../infrastructure/local/local-models.cjs');
const { RuntimeInstaller } = require('../infrastructure/local/runtime-installer.cjs');
const { reapOrphans } = require('../infrastructure/local/process-reaper.cjs');
const { MODEL_CATALOG } = require('../domain/providers/model-catalog.cjs');
const { createLocalModelManagement } = require('../application/local/manage.cjs');
const { registerLocalModels } = require('../interface/ipc/local-models.cjs');

// Builds the local model runtimes and their installer, and wires local model management to its IPC channels.
// A managed server left running by a crash or a force quit is reaped before any IPC channel can start a new one.
async function composeLocalModels({ handle, directory, settings, providers, picker, broadcast }) {
  const models = new LocalModels(directory, (value) => broadcast('local:changed', value));
  await reapOrphans({ file: models.runningServersFile(), execFile: promisify(execFile), kill: process.kill, delay });
  const installer = new RuntimeInstaller(models, (value) => broadcast('runtimes:changed', value));
  registerLocalModels(
    handle,
    createLocalModelManagement({ models, installer, catalog: MODEL_CATALOG, settings, picker, providers }),
  );
  return { models, installer };
}
module.exports = { composeLocalModels };
