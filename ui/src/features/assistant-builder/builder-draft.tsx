import { Sparkles } from 'lucide-react'
import { ActionButton } from '@/components/ui/action-button'
import type { AssistantDraft } from '@/bridge/types/assistants'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'

// The assistant drafted so far, unsaved until reviewed in the assistant dialog, or what to ask for first.
export function BuilderDraft({ draft, busy }: { draft: AssistantDraft | undefined; busy: boolean }) {
  const ws = useWorkspace()
  const { t } = useT()
  if (!draft)
    return (
      <div className="chat-empty">
        <span className="chat-empty-icon">
          <Sparkles aria-hidden="true" className="size-5" />
        </span>
        <h3 className="text-sm font-medium">{t('builder.emptyTitle')}</h3>
        <p className="max-w-[44ch] text-sm leading-relaxed text-muted-foreground">{t('builder.emptyHint')}</p>
      </div>
    )
  return (
    <div className="grid gap-3">
      <div>
        <h3 className="text-base font-semibold">{draft.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('builder.unsaved', { category: draft.category })}</p>
      </div>
      <p className="max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-relaxed">{draft.systemPrompt}</p>
      <p className="text-xs text-muted-foreground">
        {draft.requireCertainty ? t('builder.certaintyOn') : t('builder.certaintyOff')} {t('builder.reviewFields')}
      </p>
      <ActionButton
        className="w-fit"
        type="button"
        disabled={busy}
        onClick={() => ws.setDialog({ type: 'assistant', draft })}
      >
        {t('builder.review')}
      </ActionButton>
    </div>
  )
}
