const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { MAX_MODEL_BYTES, checkModelMagic } = require('../../domain/providers/local-server.cjs');
const { hashedCopy } = require('./hashed-copy.cjs');

// LocalModels methods that write new model and projector files: each is copied to a private partial file, checked
// (format, size, digest), renamed into place and only then recorded in the catalog.
const modelImports = {
  async ingest(type, name, source, expected, operation, extra = {}, offset = 0) {
    const model = {
      id: randomUUID(),
      kind: type,
      name: String(name).trim().slice(0, 120) || 'Local model',
      sha256: '',
      bytes: 0,
      ...extra,
    };
    const target = this.modelPath(model),
      temporary = target + '.partial';
    let file,
      last = 0;
    try {
      file = await fsp.open(temporary, 'wx', 0o600);
      const copied = await hashedCopy(file, source, {
        signal: operation.controller.signal,
        maxBytes: MAX_MODEL_BYTES,
        limitMessage: 'Model exceeds the 32 GB import limit.',
        check: () => {
          if (this.closed) throw new Error('Import cancelled.');
        },
        onBytes: (bytes) => {
          model.bytes = bytes;
          operation.bytes = offset + bytes;
          if (Date.now() - last > 500) {
            this.emit();
            last = Date.now();
          }
        },
      });
      checkModelMagic(type, copied.magic);
      model.sha256 = copied.sha256;
      if (expected && model.sha256 !== expected.toLowerCase())
        throw new Error('SHA-256 mismatch. The model was discarded.');
      await file.sync();
      await file.close();
      file = null;
      await fsp.rename(temporary, target);
      this.catalog.models.push(model);
      try {
        this.persist();
      } catch (error) {
        if (!error.committed) {
          this.catalog.models.pop();
          await fsp.rm(target, { force: true });
        }
        throw error;
      }
      return model;
    } finally {
      await file?.close();
      await fsp.rm(temporary, { force: true });
    }
  },
  async importFile(type, file) {
    const op = this.begin(type, 'importing');
    try {
      const stat = await fsp.stat(file);
      if (!stat.isFile() || stat.size > MAX_MODEL_BYTES) throw new Error('Choose a model file of at most 32 GB.');
      op.total = stat.size;
      const source = fs.createReadStream(file, { signal: op.controller.signal });
      return await this.ingest(type, path.basename(file), source, null, op);
    } finally {
      delete this.operations[type];
      this.emit();
    }
  },
  async writeProjector(model, source, expected, op, offset = 0) {
    const temporary = path.join(this.directory, `${model.id}-${randomUUID()}.mmproj.partial`);
    let output;
    try {
      output = await fsp.open(temporary, 'wx', 0o600);
      const copied = await hashedCopy(output, source, {
        signal: op.controller.signal,
        maxBytes: MAX_MODEL_BYTES,
        limitMessage: 'Projector exceeds the 32 GB limit.',
        onBytes: (bytes) => {
          op.bytes = offset + bytes;
        },
      });
      if (copied.magic.toString() !== 'GGUF') throw new Error('Choose a GGUF vision projector.');
      if (expected && copied.sha256 !== expected.toLowerCase())
        throw new Error('Projector SHA-256 mismatch. The projector was discarded.');
      await output.sync();
      await output.close();
      output = null;
      const previous = model.projector,
        previousPath = previous ? this.projectorPath(model) : null,
        next = { bytes: copied.bytes, sha256: copied.sha256 };
      const target = this.projectorPath({ ...model, projector: next });
      await fsp.rename(temporary, target);
      model.projector = next;
      try {
        this.persist();
      } catch (error) {
        if (!error.committed) {
          model.projector = previous;
          if (target !== previousPath) await fsp.rm(target, { force: true });
        }
        throw error;
      }
      if (previousPath && previousPath !== target) await fsp.rm(previousPath, { force: true });
    } finally {
      await output?.close();
      await fsp.rm(temporary, { force: true });
    }
  },
  async importProjector(id, file) {
    const model = this.catalog.models.find((m) => m.id === id && m.kind === 'llm');
    if (!model) throw new Error('Language model not found.');
    if (this.runtimes.llm?.child) throw new Error('Stop the language model server before changing its projector.');
    const op = this.begin('llm', 'importing-projector');
    try {
      const stat = await fsp.stat(file);
      if (!stat.isFile() || stat.size > MAX_MODEL_BYTES) throw new Error('Choose a projector file of at most 32 GB.');
      op.total = stat.size;
      await this.writeProjector(model, fs.createReadStream(file, { signal: op.controller.signal }), null, op);
      return this.state();
    } finally {
      delete this.operations.llm;
      this.emit();
    }
  },
};

module.exports = { modelImports };
