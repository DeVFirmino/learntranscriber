import { isValidElement, useMemo, type ReactNode } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { documentT as t } from '@/i18n'
import { safeResponseLink } from '@/features/response-link'
import { hideQuizWhileStreaming, parsePracticeQuiz } from '@/features/practice-quiz'
import { CodeBlock } from './response/code-block'
import { PracticeQuiz, PracticeQuizUnavailable } from './response/practice-quiz'
import { ResponseLink } from './response/response-link'

export interface ResponseActions {
  copyResponseCode: (value: string) => Promise<unknown>
  openResponseLink: (url: string) => Promise<unknown>
}

// An answer as it streams, then as Markdown without HTML, images or unsafe links.
function ResponseBody({
  content,
  streaming,
  actions,
  fontScale,
}: {
  content: string
  streaming: boolean
  actions: ResponseActions
  fontScale: number
}) {
  const components = useMemo<Components>(
    () => ({
      pre: ({ children }) => {
        if (!isValidElement<{ children?: ReactNode; className?: string }>(children)) return <pre>{children}</pre>
        const code = String(children.props.children ?? '')
        const language = /language-([\w+-]+)/.exec(children.props.className || '')?.[1] || ''
        const block = (
          <CodeBlock key={code} code={code} language={language} copy={actions.copyResponseCode} fontScale={fontScale} />
        )
        if (language !== 'quiz') return block
        const quiz = parsePracticeQuiz(code)
        if (quiz) return <PracticeQuiz key={code} questions={quiz} />
        return <PracticeQuizUnavailable key={code}>{block}</PracticeQuizUnavailable>
      },
      a: ({ href, children }) => {
        const url = safeResponseLink(href)
        return url ? (
          <ResponseLink href={url} open={actions.openResponseLink}>
            {children}
          </ResponseLink>
        ) : (
          <span>{children}</span>
        )
      },
      img: ({ alt }) => (
        <span className="text-muted-foreground">{alt ? t('response.imageAlt', { alt }) : t('response.image')}</span>
      ),
      table: ({ children }) => (
        <div
          className="my-4 max-w-full overflow-x-auto rounded-lg border"
          tabIndex={0}
          role="region"
          aria-label={t('response.table')}
        >
          <table>{children}</table>
        </div>
      ),
      h1: ({ children }) => <h3>{children}</h3>,
      h2: ({ children }) => <h3>{children}</h3>,
    }),
    [actions.copyResponseCode, actions.openResponseLink, fontScale],
  )
  const style = fontScale === 1 ? undefined : { fontSize: 14 * fontScale }
  if (streaming)
    return (
      <div
        data-response-streaming
        aria-live="polite"
        className="whitespace-pre-wrap text-sm leading-relaxed"
        style={style}
      >
        {hideQuizWhileStreaming(content, t('quiz.preparing'))}
      </div>
    )
  return (
    <div className="assistant-response min-w-0 text-sm leading-relaxed" style={style}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={components}
        skipHtml
        urlTransform={(value) => safeResponseLink(value) || ''}
      >
        {content}
      </Markdown>
    </div>
  )
}

export function AssistantResponse({
  content,
  streaming = false,
  responseId,
  actions,
  fontScale = 1,
}: {
  content: string
  streaming?: boolean
  responseId: string
  actions: ResponseActions
  fontScale?: number
}) {
  return (
    <ResponseBody key={responseId} content={content} streaming={streaming} actions={actions} fontScale={fontScale} />
  )
}
