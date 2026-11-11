const { prepareOnSessionStart } = require('../application/assistants/realtime-prompts.cjs');
const { createSessionLifecycle } = require('../application/sessions/lifecycle.cjs');
const { sessionLifecycleRepository } = require('../infrastructure/sqlite/session-lifecycle.cjs');
const { registerSessionLifecycle } = require('../interface/ipc/session-lifecycle.cjs');
const { createSessionHistory } = require('../application/sessions/history.cjs');
const { sessionHistoryRepository } = require('../infrastructure/sqlite/session-history.cjs');
const { registerSessionHistory } = require('../interface/ipc/session-history.cjs');
const { createEntryTranslator } = require('../application/sessions/translate-entry.cjs');
const { registerEntryTranslation } = require('../interface/ipc/translate-entry.cjs');
const { createEntryTranslation } = require('../application/sessions/entry-translation.cjs');
const { createFollowUpSuggestions } = require('../application/sessions/follow-ups.cjs');
const { registerFollowUps } = require('../interface/ipc/follow-ups.cjs');
const { createFollowUpGenerator } = require('../application/sessions/follow-up-generator.cjs');
const { createSessionNotes } = require('../application/sessions/session-notes.cjs');
const { registerSessionNotes } = require('../interface/ipc/session-notes.cjs');

// Wires the session lifecycle, history, summary delivery, entry translation, follow-up suggestions and session notes
// to their IPC channels.
function composeSessions({
  handle,
  repositories,
  active,
  metadata,
  requests,
  route,
  providers,
  outputLeases,
  appleSpeech,
  transcriptionJobs,
  screenInsights,
  realtimePrompts,
  isLiveNotch,
  noteFiles,
  picker,
  titles,
  saveSettings,
  changed,
}) {
  const { settings, sessions, assistants } = repositories;
  const translation = createEntryTranslation({ sessions, providers });
  const followUps = createFollowUpGenerator({ sessions, assistants, providers });
  const prepareLiveGuidance = prepareOnSessionStart({ settings, sessions, assistants, realtimePrompts });
  const lifecycle = createSessionLifecycle({
    sessions: sessionLifecycleRepository({ sessions }),
    active,
    defaults: () => ({ assistantId: settings.read().assistantId, metadata: metadata() }),
    requests: { cancelSession: (id) => requests.cancelSession(id) },
    systemAudio: outputLeases,
    appleSpeech: { stopSession: (id) => appleSpeech.stopSession(id) },
    transcriptionJobs,
    now: () => new Date(),
    // A started session gets its baseline screen read and its live-response instruction.
    started: (id) => {
      screenInsights.sessionStarted(id);
      void prepareLiveGuidance(id);
    },
    ended: (id) => void titles.title(id).catch(() => {}),
    changed,
  });
  // Startup wires the sessions before any window reads them, so sessions an earlier run left open are closed first.
  lifecycle.closeLeftOpen();
  registerSessionLifecycle(handle, lifecycle);
  registerSessionHistory(
    handle,
    createSessionHistory({
      sessions: sessionHistoryRepository({ sessions, sessionSearch: repositories.sessionSearch }),
      activeSessionId: active.id,
      changed,
    }),
  );
  registerEntryTranslation(handle, {
    requests,
    translator: createEntryTranslator({
      settings: () => settings.read(),
      translation: () => translation,
      route,
    }),
  });
  registerFollowUps(handle, {
    requests,
    followUps: createFollowUpSuggestions({
      settings: () => settings.read(),
      followUps: () => followUps,
      route,
    }),
    isLiveNotch,
  });
  registerSessionNotes(handle, {
    requests,
    notes: createSessionNotes({
      settings: () => settings.read(),
      sessions,
      assistants,
      providers,
      route,
      files: noteFiles,
      now: () => new Date(),
    }),
    picker,
    saveSettings,
  });
}
module.exports = { composeSessions };
