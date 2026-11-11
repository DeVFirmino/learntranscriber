import type { SessionDetail } from '@/bridge/types/sessions'
import { useWorkspace, useWorkspaceLive } from '@/workspace'
import { useT } from '@/use-t'

// The panel's Transcript tab: saved utterances, then what is being said right now, kept scrolled to the end.
export function TranscriptView({ session }: { session: SessionDetail | null }) {
  const ws = useWorkspace()
  const { liveCaptions } = useWorkspaceLive()
  const { t } = useT()
  const transcripts = session?.entries.filter((entry) => entry.kind === 'transcript') || []
  // What is being said right now, before each utterance is finalized and saved.
  const liveLines = Object.entries(liveCaptions).filter(([, text]) => text.trim())
  const listening = Boolean(ws.state?.overlay.listening?.active)
  const speaker = (value: string) => (value === 'ME' ? t('overlay.you') : t('overlay.others'))
  if (!transcripts.length && !liveLines.length)
    return (
      <p className="text-sm text-muted-foreground">
        {listening ? t('overlay.waitingSpeech') : t('overlay.emptyTranscript')}
      </p>
    )
  return (
    <div className="grid gap-2">
      {transcripts.map((entry) => (
        <TranscriptBubble key={entry.id} label={speaker(entry.speaker)} mine={entry.speaker === 'ME'}>
          {entry.content}
        </TranscriptBubble>
      ))}
      {liveLines.map(([who, text]) => (
        <TranscriptBubble key={`live-${who}`} label={`${speaker(who)} …`} mine={who === 'ME'} provisional>
          {text}
        </TranscriptBubble>
      ))}
    </div>
  )
}

function TranscriptBubble({
  label,
  mine,
  provisional = false,
  children,
}: {
  label: string
  mine: boolean
  provisional?: boolean
  children: string
}) {
  return (
    <div
      data-transcript-bubble
      data-speaker={mine ? 'me' : 'others'}
      className={`max-w-[85%] rounded-xl px-3 py-2 ${mine ? 'justify-self-end bg-primary/15' : 'justify-self-start bg-white/5'}`}
      aria-live={provisional ? 'polite' : undefined}
    >
      <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`whitespace-pre-wrap leading-relaxed ${provisional ? 'text-muted-foreground' : ''}`}>{children}</p>
    </div>
  )
}
