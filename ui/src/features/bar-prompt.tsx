import { modelReady, requireModelReady } from '@/features/model-setup'
import { useRef, useState } from 'react'
import { SendButton } from '@/components/ui/send-button'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

// Typed bar questions submit directly to the visible Session panel without capturing the screen.
export function BarPrompt({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string | ((current: string) => string)) => void
}) {
  const ws = useWorkspace()
  const { t } = useT()
  const ready = modelReady(ws.state)
  const [sending, setSending] = useState(false)
  const submitting = useRef(false)
  const submit = async () => {
    const text = value.trim()
    if (!ready || !text || submitting.current || ws.requestId) return
    submitting.current = true
    const sessionId = ws.state?.activeSessionId
    onChange('')
    setSending(true)
    try {
      await ws.api.showOverlay(true)
      const current = await ws.api.state()
      if (current.activeSessionId !== sessionId) throw new Error('The session changed during the request.')
      requireModelReady(current)
      await ws.runGeneration('chat', text)
    } catch (error) {
      // Preserve the draft if opening fails, without replacing newer typing.
      onChange((current) => current || text)
      throw error
    } finally {
      submitting.current = false
      setSending(false)
    }
  }
  return (
    <form
      data-bar-prompt
      aria-busy={sending}
      className="flex h-9 min-w-0 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 pr-1 pl-3"
      onSubmit={(event) => {
        event.preventDefault()
        void ws.act(submit)
      }}
    >
      <input
        name="barPrompt"
        aria-label={t('overlay.barPromptLabel')}
        placeholder={t('overlay.barPrompt')}
        maxLength={20000}
        autoComplete="off"
        value={value}
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.currentTarget.blur()
        }}
      />
      {sending ? (
        <span role="status" className="max-w-36 shrink-0 truncate text-xs text-muted-foreground">
          {t('overlay.processing')}
        </span>
      ) : null}
      <SendButton
        label={t(ready ? 'home.ask' : 'error.connectAiModel')}
        busy={sending || Boolean(ws.requestId)}
        disabled={!ready || !value.trim() || Boolean(ws.requestId)}
      />
    </form>
  )
}
