import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, WrapText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { documentT as t } from '@/i18n'
import { highlightCode } from '@/features/code-highlight'
import './code-block.css'
import type { ResponseActions } from '../assistant-response'

// One code block of an answer, with its language and a Copy button that confirms for a moment or reports a failure.
export function CodeBlock({
  code,
  language,
  copy,
  fontScale,
}: {
  code: string
  language: string
  copy: ResponseActions['copyResponseCode']
  fontScale: number
}) {
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const [wrap, setWrap] = useState(true)
  const highlighted = useMemo(() => highlightCode(code, language), [code, language])
  const mounted = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])
  const onCopy = async () => {
    if (state === 'copying') return
    if (timer.current) clearTimeout(timer.current)
    setState('copying')
    try {
      await copy(code)
      if (!mounted.current) return
      setState('copied')
      timer.current = setTimeout(() => setState('idle'), 1800)
    } catch {
      if (mounted.current) setState('error')
    }
  }
  const label = () => {
    if (state === 'copied') return t('response.copied')
    return state === 'copying' ? t('response.copying') : t('response.copy')
  }
  return (
    <div data-code-block className="response-code-block my-4 min-w-0 max-w-full rounded-lg border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{language || t('response.code')}</span>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={wrap}
            onClick={() => setWrap(!wrap)}
            aria-label={t('response.wrapCode')}
            title={t('response.wrapCode')}
          >
            <WrapText aria-hidden="true" />
            {t('response.wrap')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={state === 'copying'}
            onClick={() => void onCopy()}
            aria-label={state === 'copied' ? t('response.codeCopied') : t('response.copyCode')}
          >
            {state === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {label()}
          </Button>
        </div>
      </div>
      <pre
        className="response-code overflow-x-auto p-4 text-sm leading-relaxed"
        data-wrap={wrap}
        role="region"
        style={fontScale === 1 ? undefined : { fontSize: 14 * fontScale }}
        tabIndex={0}
        aria-label={language ? t('response.languageCode', { language }) : t('response.codeBlock')}
      >
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
      {state === 'error' ? (
        <p className="px-3 pb-3 text-xs text-destructive" role="alert">
          {t('response.copyFailed')}
        </p>
      ) : null}
    </div>
  )
}
