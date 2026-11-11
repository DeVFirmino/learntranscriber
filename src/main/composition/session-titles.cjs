const { createSessionTitles } = require('../application/sessions/session-titles.cjs');

const BACKFILL_DELAY_MS = 20000;

function composeSessionTitles({
  sessions,
  sessionSearch,
  settings,
  activeId,
  providers,
  route,
  requests,
  changed,
  schedule,
  timers = { setTimeout, clearTimeout },
  log = console.error,
}) {
  const controller = new AbortController();
  const titles = createSessionTitles({
    sessions: { get: (id) => sessions.get(id), rename: (id, title) => sessions.update(id, { title }) },
    saved: (options) => sessionSearch.page(options).sessions,
    activeId,
    settings: () => settings.read(),
    providers,
    route,
    requests,
    recordBackfill: () => settings.update({ sessionTitlesBackfilled: true }),
    changed,
    log,
  });
  const timer = schedule
    ? timers.setTimeout(() => void titles.backfill(controller.signal).catch(log), BACKFILL_DELAY_MS)
    : null;
  return {
    title: (id) => titles.title(id, controller.signal),
    close() {
      timers.clearTimeout(timer);
      controller.abort();
      requests.cancelMode('sessionTitle');
    },
  };
}
module.exports = { composeSessionTitles };
