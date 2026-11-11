import { ComposerHeader } from './composer-header'
import { useRef, useState, type RefObject } from 'react'
import { modelReady } from '@/features/model-setup'
import { BorderBeam } from '@/components/ui/border-beam-search'
import { ModelSetupNotice } from '@/components/model-setup-notice'
import { useWorkspace } from '@/workspace'
import { SCREENSHOT_QUESTION } from '@/features/workspace/generation-controller'
import { QuestionScreenshots } from './question-screenshots'
import { canSendQuestion } from './question-admission'
import { QuestionInput } from './question-input'

// The Session tab's question box. A captured screenshot waits above it and can be sent on its own; a question that
// fails to send comes back into the box.
export function QuestionForm({
  question,
  onQuestion,
  questionRef,
  compact = false,
  onClose,
  onMinimize,
}: {
  question: string
  onQuestion: (value: string) => void
  questionRef: RefObject<HTMLTextAreaElement | null>
  compact?: boolean
  onClose?: () => void
  onMinimize?: () => void
}) {
  const ws = useWorkspace()
  const screenshots = ws.pendingImages.length > 0
  const submitting = useRef(false)
  const [preparing, setPreparing] = useState(false)
  const ready = modelReady(ws.state)
  const allowed = canSendQuestion({
    question,
    hasImages: screenshots,
    busy: preparing || Boolean(ws.requestId),
    ready,
  })
  return (
    <form
      noValidate
      data-question-box={compact ? 'compact' : 'panel'}
      className={compact ? 'p-2' : 'shrink-0 border-t border-white/10 px-3 pt-2 pb-2'}
      onSubmit={(event) => {
        event.preventDefault()
        if (!allowed || submitting.current) return
        const typed = question.trim()
        const next = typed || SCREENSHOT_QUESTION
        submitting.current = true
        setPreparing(true)
        onQuestion('')
        void ws.act(async () => {
          try {
            if (!ws.state?.activeSessionId) await ws.ensureSession()
            await ws.runGeneration('chat', next)
          } catch (error) {
            onQuestion(typed)
            throw error
          } finally {
            submitting.current = false
            setPreparing(false)
          }
        })
      }}
    >
      <ComposerHeader compact={compact} onToggle={onMinimize} onClose={onClose} />
      <div className="mb-2 empty:hidden">
        <ModelSetupNotice />
      </div>
      <BorderBeam
        size="line"
        colorVariant="ice"
        staticColors
        duration={3.1}
        borderRadius={14}
        theme={ws.state?.settings.surfaceTheme === 'light' ? 'light' : 'dark'}
        active={compact}
        strength={0.65}
        className="floating-question-beam"
      >
        <QuestionInput
          question={question}
          onQuestion={onQuestion}
          questionRef={questionRef}
          allowed={allowed}
          required={!screenshots}
          busy={preparing || Boolean(ws.requestId)}
          onCancel={
            ws.requestId
              ? () =>
                  void ws.act(async () => {
                    if (ws.requestId) await ws.api.cancel(ws.requestId)
                  })
              : undefined
          }
          onCapture={() => void ws.act(ws.captureScreen)}
          captureDisabled={
            Boolean(ws.requestId) ||
            Boolean(ws.captureState) ||
            ws.pendingImages.length >= 4 ||
            Boolean(ws.state?.settings.quickScreenshot && !ready)
          }
          attachments={<QuestionScreenshots />}
        />
      </BorderBeam>
    </form>
  )
}
