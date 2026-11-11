// Requests of these modes belong to the window that started them and stop when it is destroyed; the other
// modes (generation, memory, translation, screen insights) are left to finish or time out.
const OWNER_BOUND_MODES = new Set(['assistantBuilder', 'followUps']);

function abortsWithOwner(request, ownerId) {
  return request.owner === ownerId && OWNER_BOUND_MODES.has(request.mode);
}
module.exports = { abortsWithOwner };
