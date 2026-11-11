import { ActionButton } from '@/components/ui/action-button'
import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { AssistantDraft } from '@/bridge/types/assistants'
import { Field } from '@/components/chrome'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { categoryCounts } from '@/features/assistant-catalog'
import { initialFields } from './assistant/assistant-fields'
import { AssistantContext } from './assistant/assistant-context'
import { canonicalCategory } from './assistant/instruction-draft'
import { useInstructionDraft } from './assistant/use-instruction-draft'

// Creating or editing an assistant: a name, a category, one prompt and the assistant context.
// Prompts this editor does not show (realtime, follow-up, summary) and their settings are kept as stored.
// It can also review only the system prompt another flow proposed. A sentence in the prompt box can be drafted into
// full instructions by AI, categories are picked from the library or typed, and a new assistant is used once saved.
export function AssistantDialog({
  id,
  category,
  draft,
  systemPromptOnly = false,
  reviewSource,
}: {
  id?: string
  category?: string
  draft?: AssistantDraft
  systemPromptOnly?: boolean
  reviewSource?: string
}) {
  const ws = useWorkspace()
  const { t } = useT()
  const [uploading, setUploading] = useState(false)
  const current = ws.state?.assistants.find((item) => item.id === id)
  const [name, setName] = useState(draft?.name || current?.name || '')
  const [prompt, setPrompt] = useState(draft?.systemPrompt || current?.prompt || '')
  const [fields, setFields] = useState(() => initialFields(draft, current, category))
  const categories = categoryCounts(ws.state?.assistants ?? []).map(([name]) => name)
  const instructions = useInstructionDraft((proposal) => {
    setPrompt(proposal.prompt)
    setName((value) => value || proposal.name)
    setFields((previous) =>
      previous.category.trim() && previous.category !== 'Uncategorized'
        ? previous
        : { ...previous, category: canonicalCategory(proposal.category, categories) },
    )
  })
  const creating = !id && !systemPromptOnly
  const title = () => {
    if (systemPromptOnly) return t('assistantDialog.review')
    return id ? t('assistantDialog.edit') : t('assistants.create')
  }
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void ws.act(async () => {
          const chosen = canonicalCategory(fields.category, categories)
          const saved = await ws.api.saveAssistant(
            systemPromptOnly
              ? { id, name, prompt, category: chosen }
              : { id, name, prompt, ...fields, category: chosen },
          )
          if (creating) {
            await ws.api.settings({ assistantId: saved })
            toast.message(t('assistants.nowUsing', { name: name.trim() }))
          }
          ws.setDialog(null)
        })
      }}
    >
      <DialogHeader>
        <DialogTitle>{title()}</DialogTitle>
        {systemPromptOnly ? (
          <DialogDescription>
            {t('assistantDialog.reviewHint', { source: reviewSource || t('assistantDialog.aPrompt') })}
          </DialogDescription>
        ) : null}
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('local.name')}>
          <Input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} required />
        </Field>
        {!systemPromptOnly ? (
          <Field label={t('assistantDialog.category')}>
            <Input
              value={fields.category}
              maxLength={80}
              list="assistant-categories"
              autoComplete="off"
              onChange={(event) => setFields({ ...fields, category: event.target.value })}
            />
            <datalist id="assistant-categories">
              {categories.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Field>
        ) : null}
      </div>
      <Field label={systemPromptOnly ? t('assistantDialog.systemPrompt') : t('assistantDialog.systemInstructions')}>
        <Textarea
          value={prompt}
          className={systemPromptOnly ? 'min-h-32' : 'max-h-[40vh] min-h-36 [field-sizing:content]'}
          placeholder={systemPromptOnly ? undefined : t('assistantDialog.instructionsPlaceholder')}
          disabled={instructions.busy}
          onChange={(event) => setPrompt(event.target.value)}
          required
        />
      </Field>
      {!systemPromptOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={instructions.busy || !prompt.trim()}
            onClick={() => void instructions.draft({ name, category: fields.category, brief: prompt })}
          >
            <Sparkles aria-hidden="true" className="size-4 text-primary" />
            {instructions.busy ? t('builder.preparing') : t('assistantDialog.draftWithAi')}
          </Button>
          {instructions.busy ? (
            <Button type="button" variant="ghost" onClick={instructions.cancel}>
              {t('builder.cancel')}
            </Button>
          ) : null}
          {instructions.error ? (
            <p role="alert" className="basis-full text-sm text-destructive">
              {instructions.error}
            </p>
          ) : null}
        </div>
      ) : null}
      {!systemPromptOnly ? (
        <>
          <AssistantContext
            manual={fields.context}
            files={fields.knowledgeFiles}
            onManual={(context) => setFields((previous) => ({ ...previous, context }))}
            onFiles={(change) =>
              setFields((previous) => ({ ...previous, knowledgeFiles: change(previous.knowledgeFiles) }))
            }
            onReading={setUploading}
          />
        </>
      ) : null}
      <div className="sticky -bottom-4 -mx-4 -mb-4 flex justify-end border-t border-border bg-popover px-4 py-3">
        <ActionButton type="submit" disabled={uploading || instructions.busy}>
          {t('assistantDialog.save')}
        </ActionButton>
      </div>
    </form>
  )
}
