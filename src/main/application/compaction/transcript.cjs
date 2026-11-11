const prompts = require('../../domain/sessions/transcript-prompts.json');
const { fillTemplate, withLanguageRequirement, outputLanguage } = require('../../domain/sessions/compaction.cjs');
const { forFeature } = require('../../domain/providers/generation-presets.cjs');
const POLICY = Object.freeze({ threshold: 100, keep: 30, minNew: 20, delay: 3000 });
function eligible({ current, entries, total }) {
  return (
    total >= POLICY.threshold &&
    entries.length > POLICY.keep &&
    (!current || entries.length - POLICY.keep >= POLICY.minNew)
  );
}
function transcriptPrompt(snapshot, settings) {
  const source = snapshot.entries
    .slice(0, -POLICY.keep)
    .map((e) => `[${e.speaker || 'UNKNOWN'}]: ${e.content}`)
    .join('\n');
  return withLanguageRequirement(
    fillTemplate(snapshot.current ? prompts.update : prompts.initial, {
      transcriptText: source,
      newContent: source,
      previousSummary: snapshot.current?.content || '',
    }),
    outputLanguage(settings),
    'compacted transcript summary',
  );
}
function createTranscriptCompactor({
  repository,
  active,
  listening,
  settings,
  route,
  providers,
  changed,
  report = () => {},
  timers,
  now,
  newId,
}) {
  let timer = null,
    controller = null,
    running = null,
    sessionId = null,
    closed = false,
    poll = null;
  const enabled = (id) =>
    !closed && id === active.id() && listening().active && !listening().paused && settings().autoCompact;
  function cancel() {
    timers.clearTimeout(timer);
    timers.clearTimeout(poll);
    poll = null;
    timer = null;
    controller?.abort();
  }
  async function compact(id) {
    if (running || !enabled(id)) return;
    const snapshot = repository.snapshot(id);
    if (!eligible(snapshot)) return;
    const abort = new AbortController();
    controller = abort;
    running = (async () => {
      try {
        await route.run(
          forFeature(settings(), 'tldr'),
          async (resolved) => {
            const messages = [{ role: 'user', content: transcriptPrompt(snapshot, resolved) }];
            await providers.ready?.(resolved);
            await providers.checkContext(resolved, messages, abort.signal);
            const summary = await providers.stream(resolved, messages, () => {}, abort.signal);
            abort.signal.throwIfAborted();
            if (!enabled(id)) return;
            if (typeof summary !== 'string' || !summary.trim() || summary.length > 20000)
              throw new Error('Transcript compaction returned an invalid summary. Original transcript is unchanged.');
            const older = snapshot.entries.slice(0, -POLICY.keep);
            repository.commit(id, {
              expectedId: snapshot.current?.id || null,
              summary: summary.trim(),
              throughRowid: older.at(-1).sequence,
              newId: newId(),
              at: now().toISOString(),
            });
            changed();
          },
          { signal: abort.signal },
        );
      } catch (error) {
        if (!abort.signal.aborted) report(error.message);
      } finally {
        if (controller === abort) controller = null;
        running = null;
      }
    })();
    return running;
  }
  function update() {
    const id = active.id();
    if (sessionId !== id || !enabled(id)) {
      cancel();
      sessionId = id;
    }
    if (id && enabled(id) && poll === null) {
      poll = timers.setTimeout(() => {
        poll = null;
        update();
      }, 5000);
      poll?.unref?.();
    }
    if (!id || !enabled(id) || timer !== null || running || !eligible(repository.snapshot(id))) return;
    timer = timers.setTimeout(() => {
      timer = null;
      void compact(id);
    }, POLICY.delay);
    timer?.unref?.();
  }
  return {
    update,
    compact,
    close() {
      closed = true;
      cancel();
      return running || Promise.resolve();
    },
  };
}
module.exports = { POLICY, eligible, transcriptPrompt, createTranscriptCompactor };
