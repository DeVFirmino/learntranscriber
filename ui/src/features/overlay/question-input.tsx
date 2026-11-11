import type { ReactNode, RefObject } from 'react'
import { BrandCapture } from '@/components/brand-icon'
import { InputGroup, InputGroupAddon, InputGroupTextarea } from '@/components/ui/input-group'
import { Button } from '@/components/ui/button'
import { SendButton } from '@/components/ui/send-button'
import { useT } from '@/use-t'
import { submitsQuestion } from './question-key'

export function QuestionInput({
  question,
  onQuestion,
  questionRef,
  allowed,
  required,
  busy,
  onCancel,
  onCapture,
  captureDisabled,
  attachments,
}: {
  question: string
  onQuestion: (value: string) => void
  questionRef: RefObject<HTMLTextAreaElement | null>
  allowed: boolean
  required: boolean
  busy: boolean
  onCancel?: () => void
  onCapture: () => void
  captureDisabled: boolean
  attachments: ReactNode
}) {
  const { t } = useT()
  return (
    <InputGroup className="floating-composer" aria-label={t('overlay.followUp')}>
      <InputGroupTextarea
        ref={questionRef}
        name="question"
        aria-label={t('overlay.followUp')}
        placeholder={t('overlay.followUpPlaceholder')}
        rows={1}
        required={required}
        maxLength={20000}
        value={question}
        onChange={(event) => onQuestion(event.target.value)}
        onKeyDown={(event) => {
          if (
            !submitsQuestion({
              key: event.key,
              shiftKey: event.shiftKey,
              composing: event.nativeEvent.isComposing,
              keyCode: event.nativeEvent.keyCode,
            })
          )
            return
          event.preventDefault()
          if (allowed) event.currentTarget.form?.requestSubmit()
        }}
      />
      <InputGroupAddon align="block-start">{attachments}</InputGroupAddon>
      <InputGroupAddon align="block-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="floating-composer-capture"
          disabled={captureDisabled}
          onClick={onCapture}
          aria-label={t('home.capture')}
          title={t('home.capture')}
        >
          <BrandCapture aria-hidden="true" />
          {t('notch.capture')}
        </Button>
        <SendButton
          label={t(busy && onCancel ? 'session.cancelResponse' : 'overlay.send')}
          busy={busy}
          onCancel={onCancel}
          disabled={!allowed}
        />
      </InputGroupAddon>
    </InputGroup>
  )
}
