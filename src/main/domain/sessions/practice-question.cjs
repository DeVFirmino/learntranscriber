// The request behind "Practice questions": a multiple-choice quiz the answer view shows one question at a time,
// revealing each answer only after the learner commits to a choice. The item-writing rules follow the classroom
// multiple-choice guidelines reviewed by Haladyna, Downing and Rodriguez (2002). The format uses placeholders because
// weaker models copied a concrete example instead of writing their own questions.
const PRACTICE_QUESTION = `Write 3 practice questions that check understanding of what this session covered, from the easiest to the hardest; write fewer when the transcript is too short. Write them only as one fenced code block tagged quiz with JSON and nothing else, in this shape:
\`\`\`quiz
{"questions":[{"question":"...","choices":["...","...","...","..."],"answer":0,"explanation":"..."}]}
\`\`\`
Each question has 4 parallel choices of similar length and exactly one correct choice; "answer" is its zero-based index. Make wrong choices plausible mistakes and never use "all/none of the above". Keep each explanation to one or two sentences taken from the session, in the session's language. Use only what the session covered; do not invent facts. Never write the answers outside the block.`;

module.exports = { PRACTICE_QUESTION };
