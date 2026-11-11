import './session-note-pill.css'
import { X } from 'lucide-react'
import { useT } from '@/use-t'
import type { SessionNote } from './use-session-note'

export function SessionNotePill({ note }: { note: SessionNote }) {
  const { t } = useT()
  const action = 'session-note-action'
  return (
    <div
      role={note.phase === 'error' ? 'alert' : 'status'}
      data-session-note
      data-phase={note.phase}
      className="session-note-pill [grid-area:1/1]"
    >
      {note.phase === 'ask' ? (
        <>
          <span className="truncate">{t('note.ask')}</span>
          <button type="button" className={`${action} text-primary`} onClick={note.save}>
            {t('note.save')}
          </button>
          <button type="button" className={action} onClick={note.dismiss}>
            {t('note.skip')}
          </button>
        </>
      ) : null}
      {note.phase === 'saving' ? <span className="truncate pr-1.5">{t('note.saving')}</span> : null}
      {note.phase === 'saved' ? (
        <>
          <span className="truncate" title={note.path}>
            {t('note.saved')}
          </span>
          <button type="button" className={`${action} text-primary`} onClick={note.open}>
            {t('note.open')}
          </button>
        </>
      ) : null}
      {note.phase === 'error' ? (
        <>
          <span className="truncate text-destructive" title={note.error}>
            {note.error}
          </span>
          <button type="button" className={action} onClick={note.save}>
            {t('note.retry')}
          </button>
        </>
      ) : null}
      {note.phase === 'saved' || note.phase === 'error' ? (
        <button type="button" className={action} aria-label={t('note.dismiss')} onClick={note.dismiss}>
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
