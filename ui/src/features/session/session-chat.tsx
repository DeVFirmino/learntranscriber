import type { SessionDetail } from '@/bridge/types/sessions'
import { MessageSquareText } from 'lucide-react'
import { VoiceMark } from '@/components/voice-mark'
import { MessageBubble } from '@/components/ui/message-bubble'
import { ScrollArea } from '@/components/ui/scroll-area'
import '@/components/ui/chat-thread.css'
import { AssistantResponse } from '@/components/assistant-response'
import { FollowUpSuggestions } from '@/components/follow-up-suggestions'
import { SessionPendingExchange } from '@/features/session-live'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { ChatForm } from './chat-form'
import { PendingAttachments } from './pending-attachments'
import { SessionMemory } from './session-memory'

// The conversation with the assistant about this session: its memory, the questions and answers so far, suggested
// follow-ups, what goes with the next question, and the question box.
export function SessionChat({ session }: { session: SessionDetail }) {
  const ws = useWorkspace()
  const { t } = useT()
  const messages = session.entries.filter((entry) => entry.kind !== 'transcript')
  const latestAnswer = messages.findLast((entry) => entry.kind === 'assistant')
  return (
    <section className="session-chat min-w-0" aria-label={t('session.askAssistant')}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <VoiceMark />
        {t('session.askAssistant')}
      </h2>
      <div>
        <SessionMemory session={session} />
        <ScrollArea
          data-session-chat
          follow={ws.state?.settings.autoScroll}
          aria-label={t('session.askAssistant')}
          className="session-chat-scroll h-[min(60vh,640px)] min-h-80 pr-3"
        >
          {messages.length || ws.requestId ? (
            <div className="chat-thread py-1">
              {messages.map((entry) => (
                <MessageBubble
                  key={entry.id}
                  data-response={entry.id}
                  role={entry.kind === 'user' ? 'user' : 'assistant'}
                  aria-label={entry.kind === 'user' ? t('overlay.you') : t('overlay.assistantFallback')}
                >
                  {entry.kind === 'assistant' ? (
                    <AssistantResponse responseId={entry.id} content={entry.content} actions={ws.api} />
                  ) : (
                    <p className="whitespace-pre-wrap">{entry.content}</p>
                  )}
                </MessageBubble>
              ))}
              <SessionPendingExchange />
            </div>
          ) : (
            <div className="chat-empty">
              <span className="chat-empty-icon">
                <MessageSquareText aria-hidden="true" className="size-5" />
              </span>
              <p className="max-w-[40ch] text-sm leading-relaxed text-muted-foreground">{t('session.emptyChat')}</p>
            </div>
          )}
        </ScrollArea>
        {latestAnswer ? (
          <FollowUpSuggestions
            key={`${session.id}:${latestAnswer.id}:${latestAnswer.content}`}
            sessionId={session.id}
            entryId={latestAnswer.id}
            responseLength={latestAnswer.content.trim().length}
          />
        ) : null}
        <PendingAttachments sessionId={session.id} />
        <ChatForm key={session.id} />
        <p className="mt-3 text-xs text-muted-foreground">{t('session.privacyNote')}</p>
      </div>
    </section>
  )
}
