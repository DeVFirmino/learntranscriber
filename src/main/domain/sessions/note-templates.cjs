// The sections a saved session note asks for. General is the original handoff; the others shape the same note for a
// standup, a one-on-one, an interview the user runs, or a lecture. Every template keeps the same rules: a fixed list of
// sections, "None." when one is empty, and only facts from the conversation.
const RULES = `Write "None." under a section with nothing to report. Summarize in your own words instead of copying the transcript. Use only facts from the conversation; do not invent details, decisions, dates or owners. Do not add a title or any other section.`;

const NOTE_TEMPLATES = Object.freeze({
  general: `## Summary
The summary, following the summary guidance.

## Decisions
What was decided, one bullet each.

## Open items
Questions left open, problems not yet solved and anything someone is waiting on, one bullet each.

## Next steps
Concrete next actions, with who does them when the conversation says so, one bullet each.`,
  standup: `## Summary
The summary, following the summary guidance, in two sentences at most.

## Updates by person
For each person who gave an update, a bullet with their name as the conversation gives it, then what they finished and what they are doing next.

## Blockers
What is blocking someone and who can unblock it when the conversation says so, one bullet each.

## Follow-ups
Conversations to have after the standup, one bullet each.`,
  oneOnOne: `## Summary
The summary, following the summary guidance.

## Topics
What was discussed, one bullet each.

## Feedback
Feedback given in either direction, attributed to who gave it, one bullet each.

## Action items
Who does what, and by when when the conversation says so, one bullet each.

## For next time
Topics to pick up at the next one-on-one, one bullet each.`,
  interview: `## Summary
The summary, following the summary guidance.

## Questions and answers
Each question asked, then a short account of the answer, one bullet each.

## Evidence for the role
Experience, skills and examples the candidate described, one bullet each. Report what was said; do not rate or judge the candidate.

## Open questions
What is still unclear and worth asking in a later round, one bullet each.

## Next steps
What happens next in the process when the conversation says so, one bullet each.`,
  lecture: `## Summary
The summary, following the summary guidance.

## Key terms
Each term the lecture introduced or relied on, in bold, with its definition as the lecture gave it, one bullet each.

## Main ideas
The ideas and examples the lecture built on, in the order they came, one bullet each.

## Questions to review
Questions a student could answer to check they understood, one bullet each, without answers.

## Assignments and dates
Homework, readings, deadlines and exam dates the lecture mentioned, one bullet each.`,
});

const NOTE_TEMPLATE_IDS = Object.keys(NOTE_TEMPLATES);

function noteContract(template) {
  const sections = NOTE_TEMPLATES[template] || NOTE_TEMPLATES.general;
  return `Write a Markdown note about this conversation for the user's own records, in exactly these sections:\n\n${sections}\n\n${RULES}`;
}

module.exports = { NOTE_TEMPLATE_IDS, noteContract };
