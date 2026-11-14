import { useId, useState, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react'
import { RadioGroup } from 'radix-ui'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { ChoiceTile } from '@/components/ui/choice-tile'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { documentT as t } from '@/i18n'
import { quizScore, type QuizQuestion } from '@/features/practice-quiz'
import './practice-quiz.css'

const LETTERS = 'ABCDEF'

function QuizItem({
  item,
  countId,
  selected,
  checked,
  onSelect,
  onCheck,
  onNext,
}: {
  item: QuizQuestion
  countId: string
  selected: string
  checked: number | null
  onSelect: (choice: string) => void
  onCheck: (choice: number) => void
  onNext?: () => void
}) {
  const id = useId()
  const done = checked !== null
  const result = (choice: number) => {
    if (!done) return undefined
    if (choice === item.answer) return 'correct'
    return choice === checked ? 'wrong' : 'other'
  }
  return (
    <div className="practice-quiz-item" data-checked={done || undefined}>
      <p id={`${id}-question`} className="practice-quiz-question">
        {item.question}
      </p>
      <RadioGroup.Root
        className="practice-quiz-choices"
        aria-labelledby={`${countId} ${id}-question`}
        value={done ? String(checked) : selected}
        onValueChange={onSelect}
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
      ) : null}
      {!done ? (
        <ActionButton type="button" size="sm" disabled={selected === ''} onClick={() => onCheck(Number(selected))}>
          {t('quiz.check')}
        </ActionButton>
      ) : onNext ? (
        <ActionButton type="button" size="sm" onClick={onNext}>
          {t('quiz.next')}
        </ActionButton>
      ) : null}
    </div>
  )
}

// A practice quiz from an answer's `quiz` block, one question at a time: choose, check, then move on. Each answer and
// explanation shows only after its question is checked; the arrows and steps revisit any question. Nothing is saved.
export function PracticeQuiz({ questions }: { questions: QuizQuestion[] }) {
  const empty = () => questions.map(() => null)
  const [round, setRound] = useState(0)
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<string[]>(() => questions.map(() => ''))
  const [checked, setChecked] = useState<(number | null)[]>(empty)
  const score = quizScore(questions, checked)
  const last = questions.length - 1
  const update = <T,>(values: T[], value: T) => values.map((item, index) => (index === current ? value : item))
  const step = (index: number) => {
    if (checked[index] === null) return 'open'
    return checked[index] === questions[index].answer ? 'correct' : 'wrong'
  }
  const retry = () => {
    setChecked(empty())
    setSelected(questions.map(() => ''))
    setCurrent(0)
    setRound(round + 1)
  }
  const countId = useId()
  return (
    <section data-practice-quiz className="practice-quiz" aria-label={t('quiz.label')}>
      <div className="practice-quiz-header">
        <span id={countId} className="practice-quiz-count" aria-live="polite">
          {t('quiz.position', { index: current + 1, total: questions.length })}
        </span>
        <div className="practice-quiz-steps">
          {questions.map((_, index) => (
            <button
              key={index}
              type="button"
              className="practice-quiz-step"
              data-result={step(index)}
              aria-current={index === current ? 'step' : undefined}
              aria-label={t('quiz.goTo', { index: index + 1 })}
              onClick={() => setCurrent(index)}
            />
          ))}
        </div>
        <div className="practice-quiz-nav">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t('quiz.previous')}
            disabled={current === 0}
            onClick={() => setCurrent(current - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t('quiz.next')}
            disabled={current === last}
            onClick={() => setCurrent(current + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
      <QuizItem
        key={`${round}-${current}`}
        item={questions[current]}
        countId={countId}
        selected={selected[current]}
        checked={checked[current]}
        onSelect={(choice) => setSelected(update(selected, choice))}
        onCheck={(choice) => setChecked(update(checked, choice))}
        onNext={current < last ? () => setCurrent(current + 1) : undefined}
      />
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

// A quiz block the model wrote in the wrong shape: a short notice, with the original text (which may hold the answers)
// behind a disclosure instead of shown outright.
export function PracticeQuizUnavailable({ children }: { children: ReactNode }) {
  return (
    <Collapsible data-practice-quiz-unavailable className="practice-quiz practice-quiz-unavailable">
      <p className="practice-quiz-notice">{t('quiz.unavailable')}</p>
      <CollapsibleTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="practice-quiz-original">
          {t('quiz.showOriginal')}
          <ChevronDown aria-hidden="true" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}
