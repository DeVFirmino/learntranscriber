import { useState, type ReactNode } from 'react'
import { documentT as t } from '@/i18n'
import type { ResponseActions } from '../assistant-response'

// A safe link in an answer, opened in the browser by the app; a link that cannot open says so beside it.
export function ResponseLink({
  href,
  children,
  open,
}: {
  href: string
  children: ReactNode
  open: ResponseActions['openResponseLink']
}) {
  const [failed, setFailed] = useState(false)
  return (
    <>
      <a
        href={href}
        rel="noreferrer noopener"
        className="underline decoration-primary/60 underline-offset-4 hover:text-primary"
        onClick={(event) => {
          event.preventDefault()
          setFailed(false)
          void open(href).catch(() => setFailed(true))
        }}
      >
        {children}
      </a>
      {failed ? (
        <span className="ml-2 text-xs text-destructive" role="alert">
          {t('response.linkFailed')}
        </span>
      ) : null}
    </>
  )
}
