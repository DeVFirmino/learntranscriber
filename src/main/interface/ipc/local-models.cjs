function registerLocalModels(handle, local) {
  handle('models:list', (_event, provider) => local.list(typeof provider === 'string' ? provider : undefined));
  handle('runtimes:install', (_event, kind) => local.install(kind));
  handle('runtimes:cancel', (_event, kind) => local.cancelInstall(kind));
  handle('catalog:download', (_event, id) => local.downloadCatalog(id));
  handle('local:state', () => local.state());
  handle('local:pick-binary', (event, type) => local.pickBinary(event.sender, type));
  handle('local:import', (event, type) => local.importModel(event.sender, type));
  handle('local:import-projector', (event, id) => local.importProjector(event.sender, id));
  handle('local:download', (_event, input) => local.download(input));
  handle('local:cancel', (_event, type) => local.cancel(type));
  handle('local:verify', (_event, id) => local.verify(id));
  handle('local:remove', (_event, id) => local.remove(id));
  handle('local:context-size', (_event, input) => local.setContextSize(input));
  handle('local:launch-settings', (_event, input) => local.setLaunchSettings(input));
  handle('local:start', (_event, id) => local.start(id));
  handle('local:stop', (_event, type) => local.stop(type));
}
module.exports = { registerLocalModels };
