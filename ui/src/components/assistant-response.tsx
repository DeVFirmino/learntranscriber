import { createContext, isValidElement, useContext, type ReactNode } from 'react'
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

// What the Markdown components below need from the answer being shown.
const ResponseContext = createContext<{ actions: ResponseActions; fontScale: number } | null>(null)

function ResponsePre({ children }: { children?: ReactNode }) {
  const response = useContext(ResponseContext)
  if (!response || !isValidElement<{ children?: ReactNode; className?: string }>(children)) return <pre>{children}</pre>
  const code = String(children.props.children ?? '')
  const language = /language-([\w+-]+)/.exec(children.props.className || '')?.[1] || ''
  const block = (
    <CodeBlock
      key={code}
      code={code}
      language={language}
      copy={response.actions.copyResponseCode}
      fontScale={response.fontScale}
    />
  )
  if (language !== 'quiz') return block
  const quiz = parsePracticeQuiz(code)
  if (quiz) return <PracticeQuiz key={code} questions={quiz} />
  return <PracticeQuizUnavailable key={code}>{block}</PracticeQuizUnavailable>
}

function ResponseAnchor({ href, children }: { href?: string; children?: ReactNode }) {
  const response = useContext(ResponseContext)
  const url = safeResponseLink(href)
  return url && response ? (
    <ResponseLink href={url} open={response.actions.openResponseLink}>
      {children}
    </ResponseLink>
  ) : (
    <span>{children}</span>
  )
}

// One set of components for every answer. Markdown uses each one as a component type, so a set rebuilt when the font
// size or actions change would remount the answer and reset a quiz in progress; the changing values come through
// ResponseContext instead.
export const RESPONSE_COMPONENTS: Components = {
  pre: ResponsePre,
  a: ResponseAnchor,
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
}

// An answer as it streams, then as Markdown without HTML, images or unsafe links.
export function ResponseBody({
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
      <ResponseContext.Provider value={{ actions, fontScale }}>
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={RESPONSE_COMPONENTS}
          skipHtml
          urlTransform={(value) => safeResponseLink(value) || ''}
        >
          {content}
        </Markdown>
      </ResponseContext.Provider>
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
