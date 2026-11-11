const { text } = require('../../domain/shared/text.cjs');

const MAX_DELETED = 200;

function registerSessionLifecycle(handle, lifecycle) {
  handle('sessions:create', (_event, title) => lifecycle.create(title));
  handle('sessions:resume', (_event, id) => lifecycle.resume(id));
  handle('sessions:end', (_event, id) => lifecycle.end(id));
  handle('sessions:delete', (_event, id) => lifecycle.delete(id));
  handle('sessions:delete-many', (_event, ids) => {
    if (!Array.isArray(ids) || !ids.length || ids.length > MAX_DELETED) throw new Error('Choose sessions to delete.');
    return lifecycle.deleteMany([...new Set(ids.map((id) => text(id, 100)))]);
  });
}
module.exports = { registerSessionLifecycle };
