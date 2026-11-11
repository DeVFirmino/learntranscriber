// The built-ins the user keeps: the chosen ones missing from the library come back, the unchosen ones stored there are
// deleted. Unknown ids are refused, and the choice may not leave the library empty.
function planBuiltInChoice({ catalogIds, libraryIds, chosenIds }) {
  if (!Array.isArray(chosenIds) || chosenIds.some((id) => !catalogIds.includes(id)))
    throw new Error('Choose built-in assistants from the catalog.');
  const chosen = new Set(chosenIds);
  const restore = catalogIds.filter((id) => chosen.has(id) && !libraryIds.includes(id));
  const remove = catalogIds.filter((id) => !chosen.has(id) && libraryIds.includes(id));
  if (libraryIds.length + restore.length - remove.length < 1) throw new Error('Keep at least one assistant.');
  return { restore, remove };
}

module.exports = { planBuiltInChoice };
