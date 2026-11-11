import { Play, Check, ArrowUpRight, Pencil, Copy, Share2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Assistant } from '@/bridge/types/assistants'
import { CardMenu, type CardMenuItem } from '@/components/card-menu'
import { LibraryCard } from '@/components/library-card'
import { Button } from '@/components/ui/button'
import { AssistantPrompt } from './assistant-prompt'
import './assistant-library.css'
import { Badge } from '@/components/ui/badge'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { categoryOf, isBuiltIn } from '../assistant-catalog'
import { duplicateDraft } from './assistant-copy'
import { AssistantGlyph } from './assistant-glyph'
import { useCategoryLabel } from './use-category-label'

// One assistant: its category and whether it is custom or in use, its prompt, and one menu with Use, Edit,
// Duplicate, Share and Delete. Its name opens the editor directly.
export function AssistantCard({ assistant }: { assistant: Assistant }) {
  const ws = useWorkspace()
  const { t } = useT()
  const categoryLabel = useCategoryLabel()
  const selected = ws.state?.settings.assistantId === assistant.id
  const edit = () => ws.setDialog({ type: 'assistant', id: assistant.id })
  const choose = () =>
    void ws.act(async () => {
      await ws.api.settings({ assistantId: assistant.id })
    })
  const items: CardMenuItem[] = [
    {
      id: 'use',
      label: t('assistants.use'),
      icon: Play,
      onSelect: choose,
    },
    {
      id: 'edit',
      label: t('common.edit'),
      icon: Pencil,
      onSelect: edit,
    },
    {
      id: 'duplicate',
      label: t('assistants.duplicate'),
      icon: Copy,
      onSelect: () =>
        ws.setDialog({
          type: 'assistant',
          draft: duplicateDraft(assistant, t('assistants.copyName', { name: assistant.name })),
        }),
    },
    {
      id: 'share',
      label: t('assistants.share'),
      icon: Share2,
      onSelect: () =>
        void ws.act(async () => {
          await ws.api.exportAssistant(assistant.id)
          toast.message(t('assistants.shared'))
        }),
    },
    {
      id: 'delete',
      label: t('common.delete'),
      icon: Trash2,
      destructive: true,
      onSelect: () => ws.setDialog({ type: 'assistant-delete', id: assistant.id }),
    },
  ]
  return (
    <LibraryCard
      data-assistant-card
      data-active={selected}
      selected={selected}
      glyph={
        <span className="assistant-card-avatar">
          <AssistantGlyph id={assistant.id} className="size-8 shrink-0 text-foreground" />
        </span>
      }
      title={
        <button
          type="button"
          className="assistant-card-title"
          title={t('assistantDialog.edit')}
          aria-label={`${t('assistantDialog.edit')} · ${assistant.name}`}
          onClick={edit}
        >
          {assistant.name}
        </button>
      }
      menu={
        <CardMenu
          label={`${t('assistants.actions')} · ${assistant.name}`}
          title={t('assistants.actions')}
          items={items.filter((item) => !(item.id === 'use' && selected))}
        />
      }
      badges={
        <>
          <Badge variant="outline">{categoryLabel(categoryOf(assistant))}</Badge>
          {isBuiltIn(assistant) ? null : <Badge variant="secondary">{t('assistants.custom')}</Badge>}
        </>
      }
      footer={
        <Button
          type="button"
          size="sm"
          variant={selected ? 'secondary' : 'outline'}
          className="assistant-use-button"
          disabled={selected}
          aria-label={`${t(selected ? 'assistants.active' : 'assistants.use')} · ${assistant.name}`}
          onClick={choose}
        >
          {selected ? <Check aria-hidden="true" /> : <Play aria-hidden="true" />}
          {t(selected ? 'assistants.active' : 'assistants.use')}
          {selected ? null : <ArrowUpRight aria-hidden="true" className="assistant-use-arrow" />}
        </Button>
      }
    >
      <AssistantPrompt name={assistant.name} prompt={assistant.prompt} />
    </LibraryCard>
  )
}
