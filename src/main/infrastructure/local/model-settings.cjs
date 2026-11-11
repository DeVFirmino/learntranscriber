const { contextSize } = require('../../domain/providers/context-budget.cjs');
const { launchPreferences } = require('../../domain/providers/local-launch.cjs');

// LocalModels methods for a language model's saved launch settings; a failed catalog write restores the previous ones.
const modelSettings = {
  setContextSize(id, value) {
    const model = this.catalog.models.find((m) => m.id === id);
    if (!model || model.kind !== 'llm') throw new Error('Choose an imported language model.');
    if (this.runtimes.llm?.child || this.operations.llm)
      throw new Error('Stop the language model server before changing its context size.');
    const previousContext = model.contextSize;
    const previousPreferences = model.launchSettings;
    model.contextSize = contextSize(value);
    if (previousPreferences) model.launchSettings = { ...previousPreferences, localContextSize: model.contextSize };
    try {
      this.persist();
    } catch (error) {
      if (previousContext === undefined) delete model.contextSize;
      else model.contextSize = previousContext;
      if (previousPreferences) model.launchSettings = previousPreferences;
      throw error;
    }
    this.emit();
    return this.state();
  },
  async setLaunchSettings(id, input, { clear = false, restart = false, settings = {} } = {}) {
    if (this.closed) throw new Error('Local models manager is closing.');
    if (typeof clear !== 'boolean' || typeof restart !== 'boolean') throw new Error('Invalid local launch action.');
    const model = this.catalog.models.find((item) => item.id === id && item.kind === 'llm');
    if (!model) throw new Error('Choose an imported language model.');
    if (this.starts.llm || this.operations.llm) throw new Error('Wait for the current local model operation.');
    const patch = clear ? null : launchPreferences(input);
    const hadPreferences = Object.hasOwn(model, 'launchSettings');
    const previous = model.launchSettings;
    const hadContext = Object.hasOwn(model, 'contextSize');
    const previousContext = model.contextSize;
    const op = this.begin('llm', 'saving-settings');
    try {
      if (clear) {
        delete model.launchSettings;
        delete model.contextSize;
      } else model.launchSettings = { ...previous, ...patch };
      try {
        this.persist();
      } catch (error) {
        if (hadPreferences) model.launchSettings = previous;
        else delete model.launchSettings;
        if (hadContext) model.contextSize = previousContext;
        else delete model.contextSize;
        throw error;
      }
      this.emit();
      if (restart) {
        await this.stop('llm');
        op.controller.signal.throwIfAborted();
        if (this.operations.llm === op) delete this.operations.llm;
        await this.start(id, settings);
      }
    } finally {
      if (this.operations.llm === op) delete this.operations.llm;
      this.emit();
    }
    return this.state();
  },
};

module.exports = { modelSettings };
