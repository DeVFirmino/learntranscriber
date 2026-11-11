import { useState } from 'react'
import { Square } from 'lucide-react'
import { BrandListen } from '@/components/brand-icon'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupTextarea } from '@/components/ui/input-group'
import { SendButton } from '@/components/ui/send-button'
import { submitsQuestion } from '@/features/overlay/question-key'
import { useT } from '@/use-t'
import { useDictation } from '../use-dictation'
import { BuilderModelPicker } from './builder-model-picker'

// The request for the builder in one prompt box, as in the floating chat: typed or dictated, sent with Enter or the
// send button, which turns into stop while the answer is prepared. The model it goes to is chosen in the box's footer.
export function BuilderForm({
  refining,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  refining: boolean
  busy: boolean
  error: string
  onSubmit: (question: string, answered: () => void) => void
  onCancel: () => void
}) {
  const { t } = useT()
  const [question, setQuestion] = useState('')
  const dictation = useDictation((text) => setQuestion((current) => `${current} ${text}`.trim().slice(0, 4000)))
  const label = refining ? t('builder.refineLabel') : t('builder.askLabel')
  const ready = Boolean(question.trim()) && !dictation.active
  let send = refining ? t('builder.refine') : t('builder.generate')
  if (busy) send = t('builder.cancel')
  return (
    <form
      className="grid gap-2"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault()
        if (ready && !busy) onSubmit(question.trim(), () => setQuestion(''))
      }}
    >
      <h3 className="text-sm font-medium">{label}</h3>
      <InputGroup className="builder-composer">
        <InputGroupTextarea
          aria-label={t('builder.requirements')}
          rows={3}
          maxLength={4000}
          required
          disabled={busy}
          value={question}
          placeholder={refining ? label : t('builder.placeholder')}
          onChange={(event) => setQuestion(event.target.value)}
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
            if (ready && !busy) event.currentTarget.form?.requestSubmit()
          }}
        />
        <InputGroupAddon align="block-end">
          <BuilderModelPicker disabled={busy} />
          <span className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={busy}
              aria-pressed={dictation.active}
              aria-label={dictation.active ? t('memoryDialog.stopDictation') : t('memoryDialog.dictate')}
              title={dictation.active ? t('memoryDialog.stopDictation') : t('memoryDialog.dictate')}
              onClick={dictation.toggle}
            >
              {dictation.active ? <Square aria-hidden="true" /> : <BrandListen aria-hidden="true" />}
            </Button>
            <SendButton label={send} busy={busy} onCancel={onCancel} disabled={!ready} />
          </span>
        </InputGroupAddon>
      </InputGroup>
      {busy ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('builder.waiting')}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
