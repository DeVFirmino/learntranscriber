import type { ReactNode } from 'react'
import { AssistantResponse, type ResponseActions } from './assistant-response'
import { useT } from '@/use-t'

export function SummaryMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-12 shrink-0"
      aria-hidden="true"
    >
      <path d="M5 11V4.5a2 2 0 0 1 2-2h7l5 5V11M14 2.5v5h5" stroke="currentColor" />
      <path
        d="M19 13.5v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6M9.5 17l1.75 1.75L15 15"
        stroke="var(--brand-icon-accent, #2581ff)"
      />
    </svg>
  )
}

// The same readable overview in the workspace and floating assistant; the editor owns saving and generation.
export function SessionSummary({
  content,
  actions,
  children,
  fontScale = 1,
}: {
  content: string
  actions: ResponseActions
  children?: ReactNode
  fontScale?: number
}) {
  const { t } = useT()
  const hasContent = Boolean(content.trim())
  return (
    <section className="session-summary min-w-0 py-3" aria-label={t('summary.heading')}>
      <header className="mb-4 flex items-center gap-3 text-foreground">
        <SummaryMark />
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{t('summary.heading')}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t(hasContent ? 'summary.readHint' : 'summary.emptyHint')}
          </p>
        </div>
      </header>
      {hasContent ? (
        <AssistantResponse responseId="session-summary" content={content} actions={actions} fontScale={fontScale} />
      ) : null}
      {children ? <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">{children}</div> : null}
    </section>
  )
}
