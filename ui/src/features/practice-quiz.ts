export interface QuizQuestion {
  question: string
  choices: string[]
  answer: number
  explanation: string
}

const MAX_QUESTIONS = 5
const text = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() !== '' && value.length <= max ? value.trim() : null

function question(value: unknown): QuizQuestion | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const prompt = text(item.question, 600)
  const explanation = text(item.explanation, 1200)
  if (!prompt || !explanation || !Array.isArray(item.choices)) return null
  const choices = item.choices.map((choice) => text(choice, 300))
  if (choices.length < 2 || choices.length > 6 || choices.some((choice) => choice === null)) return null
  if (new Set(choices).size !== choices.length) return null
  const answer = item.answer
  if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer >= choices.length) return null
  return { question: prompt, choices: choices as string[], answer, explanation }
}

// The questions of a `quiz` code block, or null when the block is not a well-formed quiz (it then shows as code).
export function parsePracticeQuiz(code: string): QuizQuestion[] | null {
  let value: unknown
  try {
    value = JSON.parse(code)
  } catch {
    return null
  }
  const items = (value as { questions?: unknown } | null)?.questions
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_QUESTIONS) return null
  const questions = items.map(question)
  return questions.some((item) => item === null) ? null : (questions as QuizQuestion[])
}

// While an answer streams as plain text, a quiz block (finished or still open) is replaced by a placeholder line,
// so its answers and explanations are never readable before the quiz renders.
export function hideQuizWhileStreaming(content: string, placeholder: string): string {
  return content.replace(
    /^[ \t]*(`{3,}|~{3,})[ \t]*quiz\b[^\n]*\n[\s\S]*?(?:^[ \t]*\1[ \t]*$|(?![\s\S]))/gm,
    placeholder,
  )
}

// Each question's result once checked: how many were answered and how many of those were right.
export function quizScore(questions: QuizQuestion[], checked: (number | null)[]) {
  const answered = checked.filter((choice) => choice !== null).length
  const correct = questions.filter((item, index) => checked[index] === item.answer).length
  return { answered, correct, total: questions.length }
}
