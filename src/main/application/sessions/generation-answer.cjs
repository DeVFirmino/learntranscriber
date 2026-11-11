const policy = require('../../domain/sessions/generation.cjs');
const { isSilentAnswer } = require('../../domain/sessions/notch-insight.cjs');

// What happens to a finished answer: a summary rewrite comes back cleaned; a live insight
// that came back as the idle "..." is dropped, keeping the last visible insight on screen; every other answer is
// saved, offered to the Notch unless it was automatic, and published to the windows.
function createAnswerPublisher({ sessions, notch, summaryRewrite, events, changed }) {
  return function publishAnswer({ id, mode, session: s, answer, sequence }) {
    if (mode === 'summaryRewrite') return summaryRewrite.clean(answer);
    if (policy.isAutomatic(mode) && isSilentAnswer(answer)) {
      events.answer({ text: '', sessionId: s.id, requestId: id, sequence, mode, silent: true }, mode);
      return '';
    }
    const answerEntry = sessions.persistOutput(s, mode, answer, id);
    const displayAckId = policy.isAutomatic(mode)
      ? null
      : notch.presentAnswer({ requestId: id, sessionId: s.id, answer, automatic: policy.isAutomatic(mode) });
    events.answer(
      {
        text: answer,
        sessionId: s.id,
        requestId: id,
        sequence,
        mode,
        ...(answerEntry ? { entryId: answerEntry.id } : {}),
        ...(displayAckId ? { displayAckId } : {}),
      },
      mode,
    );
    changed();
    return answer;
  };
}
module.exports = { createAnswerPublisher };
