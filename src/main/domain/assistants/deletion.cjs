// Which assistant stays selected after one is deleted: the selection moves only when it named the deleted assistant,
// to the general assistant when it remains, otherwise the first one left. The last assistant cannot be deleted.
function selectionAfterDelete({ remainingIds, selectedId, deletedId }) {
  if (!remainingIds.length) throw new Error('Keep at least one assistant.');
  if (selectedId !== deletedId) return selectedId;
  return remainingIds.includes('general') ? 'general' : remainingIds[0];
}

module.exports = { selectionAfterDelete };
