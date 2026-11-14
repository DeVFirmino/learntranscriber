import { useId, useState } from 'react'
import { Check, RotateCcw, X } from 'lucide-react'
import { RadioGroup } from 'radix-ui'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { ChoiceTile } from '@/components/ui/choice-tile'
import { documentT as t } from '@/i18n'
import { quizScore, type QuizQuestion } from '@/features/practice-quiz'
import './practice-quiz.css'

const LETTERS = 'ABCDEF'

function QuizItem({
  item,
  index,
  total,
  checked,
  onCheck,
}: {
  item: QuizQuestion
  index: number
  total: number
  checked: number | null
  onCheck: (choice: number) => void
}) {
  const id = useId()
  const [selected, setSelected] = useState('')
  const done = checked !== null
  const result = (choice: number) => {
    if (!done) return undefined
    if (choice === item.answer) return 'correct'
    return choice === checked ? 'wrong' : 'other'
  }
  return (
    <li className="practice-quiz-item" data-checked={done || undefined}>
      <p id={`${id}-question`} className="practice-quiz-question">
        <span className="practice-quiz-count">{t('quiz.position', { index: index + 1, total })}</span>
        {item.question}
      </p>
      <RadioGroup.Root
        className="practice-quiz-choices"
        aria-labelledby={`${id}-question`}
        value={done ? String(checked) : selected}
        onValueChange={setSelected}
        disabled={done}
      >
        {item.choices.map((choice, position) => (
          <ChoiceTile
            key={position}
            value={String(position)}
            label={choice}
            className="practice-quiz-choice"
            data-result={result(position)}
            icon={<span className="practice-quiz-letter">{LETTERS[position]}</span>}
          />
        ))}
      </RadioGroup.Root>
      {done ? (
        <div
          className="practice-quiz-feedback"
          role="status"
          data-result={checked === item.answer ? 'correct' : 'wrong'}
        >
          <span className="practice-quiz-verdict">
            {checked === item.answer ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
            {checked === item.answer ? t('quiz.correct') : t('quiz.incorrect', { letter: LETTERS[item.answer] })}
          </span>
          <span>{item.explanation}</span>
        </div>
      ) : (
        <ActionButton type="button" size="sm" disabled={selected === ''} onClick={() => onCheck(Number(selected))}>
          {t('quiz.check')}
        </ActionButton>
      )}
    </li>
  )
}

// A practice quiz from an answer's `quiz` block: one choice per question, and each answer and explanation shown only
// after that question is checked. Results stay in this view; nothing is saved.
export function PracticeQuiz({ questions }: { questions: QuizQuestion[] }) {
  const [round, setRound] = useState(0)
  const [checked, setChecked] = useState<(number | null)[]>(() => questions.map(() => null))
  const score = quizScore(questions, checked)
  const retry = () => {
    setChecked(questions.map(() => null))
    setRound(round + 1)
  }
  return (
    <section data-practice-quiz className="practice-quiz" aria-label={t('quiz.label')}>
      <ol className="practice-quiz-list">
        {questions.map((item, index) => (
          <QuizItem
            key={`${round}-${index}`}
            item={item}
            index={index}
            total={questions.length}
            checked={checked[index]}
            onCheck={(choice) => setChecked(checked.map((value, position) => (position === index ? choice : value)))}
          />
        ))}
      </ol>
      {score.answered === score.total ? (
        <div className="practice-quiz-summary">
          <span role="status">{t('quiz.score', { correct: score.correct, total: score.total })}</span>
          <Button type="button" size="sm" variant="ghost" onClick={retry}>
            <RotateCcw aria-hidden="true" />
            {t('quiz.retry')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
