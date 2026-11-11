import { ExternalLink, Pencil, Trash2 } from 'lucide-react'
import type { SessionSummary } from '@/bridge/types/sessions'
import { CardMenu } from '@/components/card-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { durationMinutes, summaryPreview, sessionTime } from './session-display'
import { SessionGlyph } from './session-glyph'

// One past session as a row, like Home's recent sessions: its own icon (or a tick box while selecting), its name,
// which opens it or ticks it, a one-line summary, when and how long, and the open, rename and delete menu.
export function SessionRow({
  session,
  selecting,
  selected,
  onToggle,
}: {
  session: SessionSummary
  selecting: boolean
  selected: boolean
  onToggle: () => void
}) {
  const ws = useWorkspace()
  const { t, language } = useT()
  const open = () => void ws.act(() => ws.openSession(session.id))
  const name = session.untitled ? t('sessions.untitled') : session.title
  const minutes = durationMinutes(session)
  const meta = [
    sessionTime(session.started_at, language),
    minutes ? t('sessions.minutes', { count: minutes }) : null,
    session.assistant_name,
  ].filter(Boolean)
  const preview = summaryPreview(session.summary)
  const placeholder = session.entry_count === 0 ? t('sessions.nothingRecorded') : t('sessions.noSummary')
  return (
    <Item data-session-row data-selected={selected || undefined} className="session-row">
      <ItemMedia className="session-row-tile">
        {selecting ? (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            aria-label={t('sessions.selectOne', { title: name })}
            className="size-5"
          />
        ) : (
          <SessionGlyph id={session.id} className="size-6 text-foreground" />
        )}
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <button type="button" className="session-row-title" onClick={selecting ? onToggle : open}>
            {name}
          </button>
        </ItemTitle>
        <ItemDescription className={`line-clamp-1 ${preview ? '' : 'italic opacity-75'}`}>
          {preview || placeholder}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <span className="session-row-meta">{meta.join(' · ')}</span>
        {selecting ? null : (
          <CardMenu
            label={`${t('sessions.actions')} · ${name}`}
            title={t('sessions.actions')}
            items={[
              { id: 'open', label: t('sessions.open'), icon: ExternalLink, onSelect: open },
              {
                id: 'rename',
                label: t('sessions.rename'),
                icon: Pencil,
                onSelect: () => ws.setDialog({ type: 'session-rename', id: session.id, title: session.title }),
              },
              {
                id: 'delete',
                label: t('common.delete'),
                icon: Trash2,
                destructive: true,
                onSelect: () => ws.setDialog({ type: 'session-delete', ids: [session.id], title: name }),
              },
            ]}
          />
        )}
      </ItemActions>
    </Item>
  )
}
