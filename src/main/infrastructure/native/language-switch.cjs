const { stopPart } = require('./speech-part.cjs');
const { requestedLanguages } = require('./live-languages.cjs');

// A live language change for one Apple Speech session: the session's helpers stop without saving and new ones start
// for the same speakers, so the session goes on. Changes never reject: a language that cannot stream is a notice and
// the running helpers go on in the old one; a new helper that fails after the old ones stopped is the session's
// caption error.
async function relaunch(service, state) {
  const setting = service.repositories.settings.read().appleSpeechLocale;
  if (state.stopping || state.setting === setting) return;
  const languages = await switchable(service, state, setting);
  if (!languages || state.stopping) return;
  const unchanged = languages.locale === state.locale && languages.alternate === state.alternate;
  Object.assign(state, languages);
  if (unchanged) return;
  const previous = [...state.parts.values()];
  const speakers = [...new Set(previous.map((part) => part.speaker))];
  state.restarting = true;
  for (const part of previous) part.retired = true;
  state.parts.clear();
  try {
    await Promise.all([
      ...previous.map((part) => stopPart(part, service.stopTimeout)),
      ...speakers.map((speaker) => service.startSpeaker(state, speaker)),
    ]);
  } catch (error) {
    if (!state.stopping) service.fail(state, error.message);
  } finally {
    state.restarting = false;
  }
}

// The languages of a new setting, or null when the helper rejects them.
async function switchable(service, state, setting) {
  const requested = requestedLanguages(setting);
  if (!service.preflight) return requested;
  try {
    return await service.checked(state, requested);
  } catch (error) {
    if (!state.stopping) service.onNotice?.(error.message);
    return null;
  }
}

module.exports = { relaunch };
