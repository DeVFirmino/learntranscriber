import { useState } from 'react'
import { ChevronDown, LibraryBig, NotebookPen } from 'lucide-react'
import type { KnowledgeFile } from '@/bridge/types/assistants'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/use-t'
import { ContextCard } from './context-card'
import { KnowledgeFiles } from './knowledge-files'

// Assistant context: uploaded files and manual text side by side. Both are saved with
// the assistant and reach the model framed as reference material after its system prompt. It is optional, so it
// starts folded unless the assistant already has some.
export function AssistantContext({
  manual,
  files,
  onManual,
  onFiles,
  onReading,
}: {
  manual: string
  files: KnowledgeFile[]
  onManual: (manual: string) => void
  onFiles: (change: (files: KnowledgeFile[]) => KnowledgeFile[]) => void
  onReading: (reading: boolean) => void
}) {
  const { t } = useT()
  const [manualOpen, setManualOpen] = useState(manual.trim().length > 0)
  const [open, setOpen] = useState(manual.trim().length > 0 || files.length > 0)
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      aria-labelledby="assistant-context-title"
      className="rounded-2xl border border-border bg-card/60"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-2xl p-4 text-left">
        <LibraryBig className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <span id="assistant-context-title" className="flex-1 text-sm font-semibold">
          {t('assistantDialog.context')}
          <span className="ml-2 font-normal text-muted-foreground">{t('assistantDialog.contextOptional')}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-3 px-4 pb-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{t('assistantDialog.contextHint')}</p>
        <div className="grid gap-3 min-[720px]:grid-cols-2">
          <KnowledgeFiles files={files} onFiles={onFiles} onReading={onReading} />
          <ContextCard
            icon={<NotebookPen className="size-4 shrink-0 text-primary" aria-hidden="true" />}
            title={t('assistantDialog.manualContext')}
            open={manualOpen}
            onOpen={setManualOpen}
          >
            <Textarea
              value={manual}
              className="min-h-32"
              maxLength={100000}
              aria-label={t('assistantDialog.manualContext')}
              placeholder={t('assistantDialog.manualPlaceholder')}
              onChange={(event) => onManual(event.target.value)}
            />
          </ContextCard>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
