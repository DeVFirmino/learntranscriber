import { ActionButton } from '@/components/ui/action-button'
import { useState } from 'react'
import { assistantDraftFromMarkdown } from '@/assistant-markdown'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/chrome'
import { errorMessage } from '@/format'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

export function AssistantImportDialog() {
  const ws = useWorkspace()
  const { t } = useT()
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void ws.api
          .importAssistant(input)
          .then((draft) => ws.setDialog({ type: 'assistant', draft }))
          .catch((failure) => setError(errorMessage(failure)))
      }}
    >
      <DialogHeader>
        <DialogTitle>{t('importDialog.title')}</DialogTitle>
        <DialogDescription>{t('importDialog.hint')}</DialogDescription>
      </DialogHeader>
      <Field label={t('importDialog.markdown')} hint={t('importDialog.markdownHint')}>
        <Input
          type="file"
          accept=".md,text/markdown"
          aria-label={t('importDialog.markdownFile')}
          onChange={(event) => {
            const picker = event.currentTarget
            const file = picker.files?.[0]
            if (!file) return
            setError('')
            picker.value = ''
            void (async () => {
              try {
                if (file.size > 80000) throw new Error(t('importDialog.tooLarge'))
                const draft = assistantDraftFromMarkdown(file.name, await file.text())
                if (picker.isConnected)
                  ws.setDialog({ type: 'assistant', draft, systemPromptOnly: true, reviewSource: file.name })
              } catch (failure) {
                if (picker.isConnected) setError(errorMessage(failure))
              }
            })()
          }}
        />
      </Field>
      <p className="text-xs text-muted-foreground">{t('importDialog.orPaste')}</p>
      <Field label={t('importDialog.json')}>
        <Textarea
          value={input}
          className="min-h-32"
          onChange={(event) => {
            setInput(event.target.value)
            setError('')
          }}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ActionButton type="submit">{t('assistantDialog.review')}</ActionButton>
    </form>
  )
}
