import { useState } from 'react'
import { SendButton } from '@/components/ui/send-button'
import { submitsQuestion } from '@/features/overlay/question-key'
import { modelReady } from '@/features/model-setup'
import { Textarea } from '@/components/ui/textarea'
import { ModelSetupNotice } from '@/components/model-setup-notice'
import { pastedImageItem, pastedImageToPng } from '@/features/paste-image'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { ChatAttachments } from './chat-attachments'

// Sending stays visible; optional context actions live in one menu. Failed sends preserve the draft.
export function ChatForm() {
  const ws = useWorkspace()
  const { t } = useT()
  const [question, setQuestion] = useState('')
  const ready = modelReady(ws.state)
  const paste = () =>
    void ws.act(async () => {
      const image = await ws.api.clipboardImage()
      if (image) ws.addPendingImage(image)
      else setQuestion(await ws.api.clipboard())
      document.getElementById('chat-input')?.focus()
    })
  return (
    <>
      <form
        className="mt-4 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const next = question.trim()
          if (!next || ws.requestId || !ready) return
          setQuestion('')
          void ws.act(async () => {
            try {
              await ws.runGeneration('chat', next)
            } catch (error) {
              setQuestion(next)
              throw error
            }
          })
        }}
      >
        <ModelSetupNotice />
        <div className="session-composer rounded-xl border border-input bg-background p-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          <Textarea
            id="chat-input"
            aria-label={t('session.question')}
            placeholder={t('session.questionPlaceholder')}
            rows={3}
            maxLength={20000}
            required
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (
                submitsQuestion({
                  key: event.key,
                  shiftKey: event.shiftKey,
                  composing: event.nativeEvent.isComposing,
                  keyCode: event.nativeEvent.keyCode,
                })
              ) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            className="max-h-60 min-h-24 resize-y !border-0 !bg-transparent px-2 py-2 !shadow-none !ring-0"
            onPaste={(event) => {
              const item = pastedImageItem(event.clipboardData.items)
              if (!item) return
              event.preventDefault()
              const file = item.getAsFile()
              if (!file) return
              void ws.act(async () => {
                const pasted = await pastedImageToPng(file)
                if ('problem' in pasted) throw new Error(t(pasted.problem))
                ws.addPendingImage(pasted.image)
              })
            }}
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <ChatAttachments onPaste={paste} />
            <SendButton
              label={t(ws.requestId ? 'session.cancelResponse' : 'session.sendLabel')}
              busy={Boolean(ws.requestId)}
              disabled={!ready || !question.trim()}
              onCancel={() =>
                void ws.act(async () => {
                  if (ws.requestId) await ws.api.cancel(ws.requestId)
                })
              }
            />
          </div>
        </div>
      </form>
    </>
  )
}
