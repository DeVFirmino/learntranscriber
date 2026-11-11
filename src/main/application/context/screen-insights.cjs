// Automatic answers from what the user selects or copies. A selection schedules one screen insight at most
// every 15 seconds; any newer selection, a concealed window, another running request or a changed live
// session cancels it. A copied selection gets an immediate chat answer under the same conditions. A
// newly started session also gets one baseline screen read, with the fast first configuration.
const INTERVAL = 15000;
const { modeConfig } = require('../../domain/sessions/realtime-policy.cjs');
const { DELAY_MS, IMAGE } = require('../../domain/sessions/fast-first.cjs');
const { jpegDataUrl } = require('./screenshot-image.cjs');

function createScreenInsights({
  settings,
  active,
  privacy,
  requests,
  speaking = () => false,
  screenshot,
  ask,
  newId,
  report,
  showSelection,
  clock,
  timers,
}) {
  let timer,
    version = 0,
    last = 0;
  const baselined = new Set();
  const quiet = () => privacy.concealed || requests.busy() || speaking();
  const enabled = () => {
    const current = settings();
    return current.autoScreenInsights && current.autoInsights !== false && modeConfig(current.insightMode).selection;
  };
  return {
    cancel() {
      timers.clearTimeout(timer);
      version++;
      requests.cancelMode('screenInsight');
    },
    selected(value) {
      showSelection(value);
      timers.clearTimeout(timer);
      const mine = ++version;
      if (!enabled()) return;
      timer = timers.setTimeout(
        async () => {
          if (mine !== version || value.sessionId !== active.id() || quiet() || !enabled()) return;
          try {
            const image = await screenshot();
            if (mine !== version || value.sessionId !== active.id() || quiet() || !enabled()) return;
            if (!ask.available()) return;
            last = clock();
            await ask.run({
              requestId: 'screen-' + newId(),
              sessionId: value.sessionId,
              mode: 'screenInsight',
              context: value.text,
              image: image.toDataURL(),
            });
          } catch (error) {
            if (error.name !== 'AbortError') report(error.message);
          }
        },
        Math.max(800, INTERVAL - (clock() - last)),
      );
      timer.unref?.();
    },
    // One baseline screen read per session, right after it starts, when screen insights are on for this mode.
    sessionStarted(sessionId) {
      if (!sessionId || baselined.has(sessionId)) return;
      baselined.add(sessionId);
      const pending = timers.setTimeout(async () => {
        if (sessionId !== active.id() || quiet() || !enabled() || !ask.available()) return;
        try {
          const image = await screenshot();
          if (sessionId !== active.id() || quiet() || !enabled()) return;
          last = clock();
          await ask.run({
            requestId: 'baseline-' + newId(),
            sessionId,
            mode: 'screenInsight',
            baseline: true,
            image: jpegDataUrl(image, IMAGE),
          });
        } catch (error) {
          if (error.name !== 'AbortError') report(error.message);
        }
      }, DELAY_MS);
      pending.unref?.();
    },
    async copied(value) {
      if (value.sessionId !== active.id() || quiet() || !ask.available()) return;
      await ask.run({
        requestId: 'copy-' + newId(),
        sessionId: value.sessionId,
        mode: 'chat',
        question: 'Explain the copied selection and give a useful next step.',
        context: value.text,
      });
    },
  };
}
module.exports = { createScreenInsights };
