// The lifecycle port: creation, reopening, ending and deletion of sessions.
function sessionLifecycleRepository({ sessions }) {
  return {
    create: (title, assistantId, metadata) => sessions.create(title, assistantId, metadata),
    reopen(id) {
      sessions.update(id, { ended_at: null });
      return sessions.get(id);
    },
    end: (id, at) => sessions.update(id, { ended_at: at }),
    closeLeftOpen: (liveId) => sessions.closeLeftOpen(liveId),
    delete: (id) => sessions.delete(id),
    deleteMany: (ids) => sessions.deleteMany(ids),
  };
}
module.exports = { sessionLifecycleRepository };
