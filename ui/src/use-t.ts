import { useCallback } from 'react'
import { resolveLanguage, translate, type MessageKey } from '@/i18n'
import { useWorkspace } from '@/workspace'

export function useT() {
  const ws = useWorkspace()
  const language = resolveLanguage(
    ws.state?.settings.uiLanguage,
    typeof navigator === 'undefined' ? 'en' : navigator.language,
  )
  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(language, key, vars),
    [language],
  )
  return { t, language }
}
