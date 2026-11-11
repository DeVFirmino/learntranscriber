const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { modelKind, downloadUrl, catalogOrigin } = require('../../domain/providers/local-server.cjs');
const { fileSha256 } = require('./hashed-copy.cjs');
const { fetchArtifact } = require('./model-download.cjs');

const DIGEST = /^[a-f\d]{64}$/i;

// LocalModels methods for the model library: server executables, downloads (vision pairs included), verification
// and removal. Each runs as the kind's single operation and keeps the catalog consistent with the disk.
const modelFiles = {
  async setBinary(type, file) {
    modelKind(type);
    if (this.runtimes[type]?.child) throw new Error('Stop this server before changing its executable.');
    if (!path.isAbsolute(file)) throw new Error('Choose an absolute executable path.');
    const op = this.begin(type, 'selecting-binary');
    try {
      const real = await fsp.realpath(file);
      if (!(await fsp.stat(real)).isFile()) throw new Error('Choose a server executable file.');
      await fsp.access(real, fs.constants.X_OK);
      op.controller.signal.throwIfAborted();
      this.catalog.binaries[type] = real;
      this.persist();
    } finally {
      delete this.operations[type];
      this.emit();
    }
  },
  /** Vision models install as a pair: the model stays unavailable until its projector is verified, and a failed projector removes the model. */
  async downloadPair(input) {
    if (!input?.projector) throw new Error('Choose a catalog model.');
    for (const digest of [input.sha256, input.projector.sha256])
      if (!DIGEST.test(digest || '')) throw new Error('Enter the model publisher’s SHA-256 digest.');
    const op = this.begin('llm', 'downloading-model');
    let model;
    try {
      op.total = (input.bytes || 0) + (input.projector.bytes || 0);
      const main = await fetchArtifact(this.fetch, input.url, op.controller.signal);
      if (!input.bytes) op.total += main.size;
      model = await this.ingest('llm', input.name || path.basename(main.url.pathname), main.body, input.sha256, op, {
        vision: true,
        ...catalogOrigin(input),
      });
      op.phase = 'downloading-projector';
      this.emit();
      const projector = await fetchArtifact(this.fetch, input.projector.url, op.controller.signal);
      if (!input.projector.bytes) op.total += projector.size;
      await this.writeProjector(model, projector.body, input.projector.sha256, op, model.bytes);
      return model;
    } catch (error) {
      if (model) {
        await fsp.rm(this.modelPath(model), { force: true });
        this.catalog.models = this.catalog.models.filter((m) => m.id !== model.id);
        this.persist();
      }
      throw error;
    } finally {
      delete this.operations.llm;
      this.emit();
    }
  },
  async download(input) {
    if (input?.projector) return this.downloadPair(input);
    const type = modelKind(input.kind);
    downloadUrl(input.url);
    if (!DIGEST.test(input.sha256 || '')) throw new Error('Enter the model publisher’s SHA-256 digest.');
    const op = this.begin(type, 'downloading');
    try {
      const artifact = await fetchArtifact(this.fetch, input.url, op.controller.signal);
      op.total = artifact.size;
      const name = input.name || path.basename(artifact.url.pathname);
      return await this.ingest(type, name, artifact.body, input.sha256, op, catalogOrigin(input));
    } finally {
      delete this.operations[type];
      this.emit();
    }
  },
  async verify(id) {
    const model = this.catalog.models.find((m) => m.id === id);
    if (!model) throw new Error('Model not found.');
    const op = this.begin(model.kind, 'verifying');
    try {
      for (const [file, digest, label] of [
        [this.modelPath(model), model.sha256, 'model'],
        ...(model.projector ? [[this.projectorPath(model), model.projector.sha256, 'vision projector']] : []),
      ])
        if ((await fileSha256(file, op.controller.signal)) !== digest)
          throw new Error(`The ${label} changed on disk. Remove it and import it again.`);
      return true;
    } finally {
      delete this.operations[model.kind];
      this.emit();
    }
  },
  async remove(id) {
    const model = this.catalog.models.find((m) => m.id === id);
    if (!model) throw new Error('Model not found.');
    if (this.operations[model.kind] || this.runtimes[model.kind]?.child)
      throw new Error('Stop the server and wait for model operations before removing a model.');
    const op = this.begin(model.kind, 'removing');
    try {
      const files = [this.modelPath(model), this.projectorPath(model)];
      this.catalog.models = this.catalog.models.filter((m) => m.id !== id);
      try {
        this.persist();
      } catch (error) {
        this.catalog.models.push(model);
        throw error;
      }
      await Promise.all(files.map((file) => fsp.rm(file, { force: true })));
    } finally {
      if (this.operations[model.kind] === op) delete this.operations[model.kind];
      this.emit();
    }
  },
};

module.exports = { modelFiles };
