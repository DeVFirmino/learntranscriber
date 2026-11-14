// The instruction for a session summary. It applies to every assistant, built in or created by the user, and shapes
// the notes to the kind of session the transcript shows, so a class, an interview and a meeting each get useful notes.
const SUMMARY_QUESTION = `Write detailed notes of this session from its transcript, so that someone who missed it learns everything that was said.
First work out what kind of session it is (a class or lecture, an interview, a meeting, a call, or another conversation) and organize the notes for it:
- Class or lecture: every topic in the order it was taught, with the concepts, definitions, explanations, examples, formulas and numbers given, then the questions asked and their answers.
- Interview: each question and the substance of each answer, then strengths, concerns and follow-ups.
- Meeting or call: the topics discussed, decisions and their reasons, action items with owners and dates, and open questions.
Start with a short overview, then the detailed sections under Markdown headings with bullet points, and end with a glossary when technical terms came up.
Cover every substantive point: the length follows the session, and a long session never becomes a few lines. Leave out a section that would be empty instead of writing "none".
The transcript comes from live speech recognition and has errors: read misrecognized words in context (for example "last function" for "loss function") and write the intended term, but never add anything that was not said.
Assistant answers in the session are secondary; the notes are about what the participants said.`;

module.exports = { SUMMARY_QUESTION };
