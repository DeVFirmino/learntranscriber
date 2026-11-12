import { memo } from 'react'
import type { Entry, SessionDetail } from '@/bridge/types/sessions'
import { useWorkspace, useWorkspaceLive } from '@/workspace'
import { useT } from '@/use-t'
import './conversation.css'

// The panel's Transcript tab: saved utterances, then what is being said right now, kept scrolled to the end.
export function TranscriptView({ session }: { session: SessionDetail | null }) {
  const ws = useWorkspace()
  const { liveCaptions } = useWorkspaceLive()
  const { t } = useT()
  const entries = session?.entries || NO_ENTRIES
  const saved = entries.some((entry) => entry.kind === 'transcript')
  // What is being said right now, before each utterance is finalized and saved.
  const liveLines = Object.entries(liveCaptions).filter(([, text]) => text.trim())
  const listening = Boolean(ws.state?.overlay.listening?.active)
  const speaker = (value: string) => (value === 'ME' ? t('overlay.you') : t('overlay.others'))
  if (!saved && !liveLines.length)
    return (
      <p className="text-sm text-muted-foreground">
        {listening ? t('overlay.waitingSpeech') : t('overlay.emptyTranscript')}
      </p>
    )
  return (
    <div className="grid gap-2">
      <SavedTranscript entries={entries} you={t('overlay.you')} others={t('overlay.others')} />
      {liveLines.map(([who, text]) => (
        <TranscriptBubble key={`live-${who}`} label={`${speaker(who)} …`} mine={who === 'ME'} provisional>
          {text}
        </TranscriptBubble>
      ))}
    </div>
  )
}

const NO_ENTRIES: Entry[] = []

// The finalized utterances. Live captions change many times a second; this list re-renders only when the session's
// entries or the speaker labels change, so a long session does not redraw every bubble on each caption.
const SavedTranscript = memo(function SavedTranscript({
  entries,
  you,
  others,
}: {
  entries: Entry[]
  you: string
  others: string
}) {
  return entries
    .filter((entry) => entry.kind === 'transcript')
    .map((entry) => (
      <TranscriptBubble
        key={entry.id}
        label={entry.speaker === 'ME' ? you : others}
        mine={entry.speaker === 'ME'}
        saved
      >
        {entry.content}
      </TranscriptBubble>
    ))
})

function TranscriptBubble({
  label,
  mine,
  provisional = false,
  saved = false,
  children,
}: {
  label: string
  mine: boolean
  provisional?: boolean
  saved?: boolean
  children: string
}) {
  return (
    <div
      data-transcript-bubble
      data-speaker={mine ? 'me' : 'others'}
      className={`max-w-[85%] rounded-xl px-3 py-2 ${mine ? 'justify-self-end bg-primary/15' : 'justify-self-start bg-white/5'} ${saved ? 'saved-bubble' : ''}`}
      aria-live={provisional ? 'polite' : undefined}
    >
      <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`whitespace-pre-wrap leading-relaxed ${provisional ? 'text-muted-foreground' : ''}`}>{children}</p>
    </div>
  )
}
