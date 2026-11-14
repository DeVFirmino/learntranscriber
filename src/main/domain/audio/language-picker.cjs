// Chooses which of two recognizers a speaker's captions come from when both hear the same audio, one per language.
// Apple Speech cannot detect the language and its on-device results carry no confidence, but a recognizer in the
// wrong language recognizes little ("Yes", "No") while the right one writes whole sentences, so the language that
// produced more words recently wins. Finals are held until the first decision, so the wrong language is never saved;
// a later switch also publishes the new language's recent finals, which covered the same speech.
const WINDOW_MS = 20000;
const DECIDE_WORDS = 6;
const DECIDE_MS = 8000;
const SWITCH_RATIO = 1.5;
const SWITCH_MARGIN = 5;

const words = (text) => (String(text).match(/[\p{L}\p{N}]+/gu) || []).length;

function createLanguagePicker({ primary, alternate }) {
  const recent = { [primary]: [], [alternate]: [] };
  let active = null;
  let firstHeard = null;

  const prune = (now) => {
    for (const locale of [primary, alternate])
      recent[locale] = recent[locale].filter((item) => now - item.at <= WINDOW_MS);
  };
  const score = (locale) => recent[locale].reduce((total, item) => total + item.words, 0);
  const other = (locale) => (locale === primary ? alternate : primary);
  // Finals of `locale` not published yet, oldest first; publishing marks them.
  const unpublished = (locale) =>
    recent[locale]
      .filter((item) => !item.published)
      .map((item) => {
        item.published = true;
        return { type: 'final', text: item.text };
      });

  return {
    get active() {
      return active;
    },
    // One event of the `locale` recognizer at time `now`; returns the events to publish, in order.
    receive(locale, event, now) {
      if (locale !== primary && locale !== alternate) return [];
      prune(now);
      const counted = event.type === 'final' ? words(event.text) : 0;
      if (counted) {
        recent[locale].push({ at: now, words: counted, text: event.text, published: false });
        firstHeard ??= now;
      }
      if (active === null) {
        const decided =
          Math.max(score(primary), score(alternate)) >= DECIDE_WORDS ||
          (firstHeard !== null && now - firstHeard >= DECIDE_MS);
        if (!decided) return [];
        active = score(alternate) > score(primary) ? alternate : primary;
        for (const item of recent[other(active)]) item.published = true;
        return unpublished(active);
      }
      const challenger = other(active);
      if (
        counted &&
        score(challenger) >= score(active) * SWITCH_RATIO &&
        score(challenger) - score(active) >= SWITCH_MARGIN
      ) {
        active = challenger;
        return unpublished(active);
      }
      if (locale !== active) return [];
      if (counted) recent[locale].at(-1).published = true;
      return [event];
    },
    // The session ends: decides now if no decision came yet (a tie goes to the primary) and returns the followed
    // language's finals still held, so the end of a short session is not lost.
    finish() {
      active ??= score(alternate) > score(primary) ? alternate : primary;
      return unpublished(active);
    },
    // The `locale` recognizer stopped for good: the other one is followed from now on.
    drop(locale) {
      active = other(locale);
      recent[locale] = [];
    },
  };
}

module.exports = { createLanguagePicker, WINDOW_MS, DECIDE_WORDS, DECIDE_MS, SWITCH_RATIO, SWITCH_MARGIN };
