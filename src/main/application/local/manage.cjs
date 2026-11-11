const { text } = require('../../domain/shared/text.cjs');

const TYPES = ['llm', 'whisper'];

// Local model servers, files and runtimes. A server cannot start while a runtime is installing, and a
// cancelled file dialog changes nothing.
function createLocalModelManagement({ models, installer, catalog, settings, picker, providers }) {
  async function picked(owner, kind, apply) {
    const file = await picker.pick(owner, kind);
    if (file) await apply(file);
    return models.state();
  }
  return {
    // The models of the current provider, or of `provider` when the Models tab lists another provider's group.
    async list(provider) {
      const current = provider ? { ...settings(), provider } : settings();
      if (current.provider !== 'local') return providers.models(current);
      const lease = models.acquire('llm');
      try {
        return await providers.models({
          ...current,
          provider: 'custom',
          managedLocal: true,
          customBaseUrl: lease.base + '/v1',
        });
      } finally {
        lease.release();
      }
    },
    install: (kind) => installer.install(kind),
    cancelInstall(kind) {
      installer.cancel(kind);
      return true;
    },
    async downloadCatalog(id) {
      const model = catalog.find((m) => m.id === id);
      if (!model) throw new Error('Choose a catalog model.');
      await models.download(model);
      return models.state();
    },
    state: () => models.state(),
    async pickBinary(owner, type) {
      if (!TYPES.includes(type)) throw new Error('Invalid server type.');
      return picked(owner, type === 'llm' ? 'llmServer' : 'whisperServer', (file) => models.setBinary(type, file));
    },
    async importModel(owner, type) {
      if (!TYPES.includes(type)) throw new Error('Invalid model type.');
      return picked(owner, type === 'llm' ? 'llmModel' : 'whisperModel', (file) => models.importFile(type, file));
    },
    importProjector: (owner, id) => picked(owner, 'projector', (file) => models.importProjector(text(id, 100), file)),
    async download(input) {
      await models.download(input);
      return models.state();
    },
    cancel(type) {
      models.cancel(type);
      return true;
    },
    verify: (id) => models.verify(id),
    async remove(id) {
      await models.remove(id);
      return models.state();
    },
    setContextSize: (input) => models.setContextSize(input.id, input.value),
    setLaunchSettings(input) {
      if (!input || typeof input !== 'object') throw new Error('Invalid local launch settings.');
      if (input.restart && installer.state().length)
        throw new Error('Wait for runtime installation before restarting a local server.');
      return models.setLaunchSettings(text(input.id, 100), input.settings, {
        clear: input.clear ?? false,
        restart: input.restart ?? false,
        settings: settings(),
      });
    },
    start(id) {
      if (installer.state().length) throw new Error('Wait for runtime installation before starting a local server.');
      return models.start(id, settings());
    },
    async stop(type) {
      await models.stop(type);
      return models.state();
    },
  };
}
module.exports = { createLocalModelManagement };
