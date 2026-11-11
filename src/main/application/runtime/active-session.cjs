// The single owner of which session is live; every reader asks id() instead of keeping a copy.
function createActiveSession() {
  let current = null;
  return {
    id: () => current,
    set(id) {
      current = id;
    },
    clear(id) {
      if (current === id) current = null;
    },
  };
}
module.exports = { createActiveSession };
