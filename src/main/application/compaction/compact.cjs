const { KEEP, compactionPrompt } = require('../../domain/sessions/compaction.cjs');
const { forFeature } = require('../../domain/providers/generation-presets.cjs');

// Summarizes the oldest uncompacted entries into a checkpoint. One compaction per session at a time; the
// checkpoint commits only if no other one landed meanwhile, and a cancelled or failed run changes nothing.
function createCompactor({ sessions, compactions, providers, now, newId }) {
  const busy = new Set();
  return {
    busy,
    async compact(id, settings, signal) {
      sessions.get(id);
      if (busy.has(id)) throw new Error('This session is already compacting.');
      busy.add(id);
      try {
        signal.throwIfAborted();
        const { current, entries } = compactions.snapshot(id);
        if (entries.length <= KEEP)
          throw new Error('Add more conversation before compacting; the latest eight entries are preserved.');
        const older = entries.slice(0, -KEEP);
        const budget = settings.managedLocal ? (settings.contextSize || 4096) * 2 : 50000;
        let selected = [],
          size = 0;
        for (const entry of older) {
          if (!settings.managedLocal && entry.content.length > budget && !selected.length)
            throw new Error(
              'This conversation entry exceeds the compaction source limit. Original entries are unchanged.',
            );
          if (size + entry.content.length > budget && selected.length) break;
          selected.push(entry);
          size += entry.content.length;
        }
        const localSettings = forFeature({ ...settings, localVoice: Boolean(settings.managedLocal) }, 'tldr');
        let messages;
        while (true) {
          messages = [
            {
              role: 'user',
              content: compactionPrompt({
                previousSummary: current?.content || '',
                entries: selected,
                settings,
              }),
            },
          ];
          if (!settings.managedLocal) break;
          try {
            await providers.checkContext(localSettings, messages, signal);
            break;
          } catch (error) {
            if (error.code !== 'CONTEXT_WINDOW_EXCEEDED' || selected.length === 1) throw error;
            selected = selected.slice(0, Math.max(1, Math.floor(selected.length / 2)));
          }
        }
        const cutoff = selected.at(-1).sequence;
        const sourceText = [current?.content || '', ...selected.map((entry) => entry.content)]
          .filter(Boolean)
          .join('\n');
        signal.throwIfAborted();
        const summary = await providers.stream(localSettings, messages, () => {}, signal);
        signal.throwIfAborted();
        // An empty summary fails. The size checks are local safeguards: the stored memory must
        // be bounded and shorter than what it replaces, or the original entries stay in the prompt.
        if (!summary?.trim()) throw new Error('Empty compaction summary. Original entries are unchanged.');
        if (summary.length > 20000)
          throw new Error('Compaction returned an invalid memory. Original entries are unchanged.');
        if (summary.length >= sourceText.length)
          throw new Error(
            'The model did not produce a shorter memory. Try a different model; original entries are unchanged.',
          );
        compactions.commit(id, {
          expectedId: current?.id || null,
          summary: summary.trim(),
          throughRowid: cutoff,
          observedThroughRowid: entries.at(-1).sequence,
          at: now().toISOString(),
          newId: newId(),
        });
        return { ...compactions.state(id), method: 'model' };
      } finally {
        busy.delete(id);
      }
    },
    undo(id) {
      if (busy.has(id)) throw new Error('Wait for compaction to finish.');
      sessions.get(id);
      compactions.undoLatest(id);
      return compactions.state(id);
    },
  };
}
module.exports = { createCompactor };
