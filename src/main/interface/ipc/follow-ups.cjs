const { text } = require('../../domain/shared/text.cjs');

// Older suggestions are a Notch feature: only the Notch window, on the live session, may ask for them.
function registerFollowUps(handle, { requests, followUps, isLiveNotch }) {
  handle('ai:follow-ups', (event, input) => {
    const id = text(input?.requestId, 100),
      sessionId = text(input?.sessionId, 100),
      entryId = text(input?.entryId, 100);
    const historical = input?.historical === true;
    if (input?.historical !== undefined && typeof input.historical !== 'boolean')
      throw new Error('Invalid suggestion history request.');
    if (historical && !isLiveNotch(event, sessionId))
      throw new Error('Only the active Notch can request older suggestions.');
    return requests.run({ id, owner: event.sender.id, sessionId, mode: 'followUps', timeoutMs: 90000 }, (signal) =>
      followUps.ask({ sessionId, entryId, historical }, signal),
    );
  });
  handle('ai:cancel', (event, id) => requests.cancel(id, event.sender.id));
}
module.exports = { registerFollowUps };
