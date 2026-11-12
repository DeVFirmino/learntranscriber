import { floatingFontSize } from './reading-size'
import { memo, type ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AssistantResponse } from '@/components/assistant-response'
import { FollowUpSuggestions } from '@/components/follow-up-suggestions'
import type { Entry, SessionDetail } from '@/bridge/types/sessions'
import { useWorkspace, useWorkspaceLive } from '@/workspace'
import { useT } from '@/use-t'
import { answerPresentation } from './answer-presentation'
import { conversationEntries } from './conversation-entries'
import { MessageBubble } from '@/components/ui/message-bubble'
import './conversation.css'

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

// Typed turns and contextual insights share the existing session store and response renderer.
export function AnswersView({ session }: { session: SessionDetail | null }) {
  const ws = useWorkspace()
  const {
    overlayAnswer,
    overlayStreaming,
    overlayResponseId,
    overlayStartedAt,
    pendingQuestion,
    overlayOutcome,
    overlayErrorCode,
    overlaySessionId,
    overlayMode,
  } = useWorkspaceLive()
  const { t } = useT()
  const fontScale = ws.state?.settings.unifiedModalFontScale ?? 1
  const messageScale = floatingFontSize(fontScale) / 14
  const presentation = answerPresentation({
    entries: session?.entries || [],
    sessionId: session?.id,
    requestId: ws.requestId,
    pendingQuestion,
    stream: {
      sessionId: overlaySessionId,
      mode: overlayMode,
      outcome: overlayOutcome,
      errorCode: overlayErrorCode,
      answer: overlayAnswer,
      streaming: overlayStreaming,
      responseId: overlayResponseId,
      startedAt: overlayStartedAt,
    },
  })
  const { latestAnswer, streaming, completion } = presentation
  return (
    <div
      className="floating-conversation"
      aria-label={t('overlay.session')}
      style={{ fontSize: floatingFontSize(fontScale) }}
    >
      {session ? (
        <SavedConversation entries={session.entries} sessionId={session.id} messageScale={messageScale} />
      ) : null}
      {presentation.showPendingQuestion ? (
        <AnswerCard role="user" time="" text={pendingQuestion}>
          <p className="whitespace-pre-wrap">{pendingQuestion}</p>
        </AnswerCard>
      ) : null}
      {presentation.showProcessing ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t('overlay.processing')}
        </p>
      ) : null}
      {presentation.showStream ? (
        <div className="animate-in duration-300 fade-in slide-in-from-bottom-1 motion-reduce:animate-none">
          <AnswerCard role={presentation.streamRole} time={formatTime(overlayStartedAt)} text={overlayAnswer}>
            <AssistantResponse
              responseId={overlayResponseId}
              content={overlayAnswer}
              streaming={streaming}
              actions={ws.api}
              fontScale={messageScale}
            />
            {completion ? (
              <p
                role={completion.role}
                className={
                  completion.role === 'alert' ? 'mt-2 text-sm text-destructive' : 'mt-2 text-sm text-muted-foreground'
                }
              >
                {t(completion.key)}
              </p>
            ) : null}
          </AnswerCard>
        </div>
      ) : null}
      {completion && presentation.showCompletionOnly ? (
        <p
          role={completion.role}
          className={completion.role === 'alert' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
        >
          {t(completion.key)}
        </p>
      ) : null}
      {presentation.showEmpty ? <p className="text-sm text-muted-foreground">{t('overlay.emptyAnswer')}</p> : null}
      {session && latestAnswer && presentation.showFollowUps ? (
        <FollowUpSuggestions
          key={latestAnswer.id}
          sessionId={session.id}
          entryId={latestAnswer.id}
          responseLength={latestAnswer.content.trim().length}
          compact
          limit={3}
        />
      ) : null}
    </div>
  )
}

// The saved turns. The streaming answer changes on every token; this list re-renders only when the session's entries
// or the reading size change, so a long session does not re-render every saved answer's Markdown while one streams.
const SavedConversation = memo(function SavedConversation({
  entries,
  sessionId,
  messageScale,
}: {
  entries: Entry[]
  sessionId: string
  messageScale: number
}) {
  const ws = useWorkspace()
  return conversationEntries(entries, sessionId).map(({ entry, role }) => (
    <AnswerCard key={entry.id} role={role} time={formatTime(entry.created_at)} text={entry.content} saved>
      {role === 'user' ? (
        <p className="whitespace-pre-wrap">{entry.content}</p>
      ) : (
        <AssistantResponse
          responseId={entry.id}
          content={entry.content}
          streaming={false}
          actions={ws.api}
          fontScale={messageScale}
        />
      )}
    </AnswerCard>
  ))
})

function AnswerCard({
  time,
  text,
  children,
  role,
  saved = false,
}: {
  time: string
  text: string
  children: ReactNode
  role: 'user' | 'assistant' | 'context'
  saved?: boolean
}) {
  const ws = useWorkspace()
  const { t } = useT()
  const label = { user: 'overlay.you', context: 'overlay.contextInsight', assistant: 'session.assistant' } as const
  return (
    <MessageBubble
      role={role}
      data-answer-card={role !== 'user' ? '' : undefined}
      className={saved ? 'saved-bubble' : undefined}
    >
      <header className="text-muted-foreground">
        <span>{t(label[role])}</span>
        <time>{time}</time>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t('session.copyActions')}
          title={t('session.copyActions')}
          onClick={() => void ws.act(async () => void (await ws.api.copyResponseCode(text)))}
        >
          <Copy className="size-3.5" />
        </Button>
      </header>
      {children}
    </MessageBubble>
  )
}
