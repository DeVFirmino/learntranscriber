import { useCallback } from 'react'
import { useT } from '@/use-t'
import { LOCAL_STRINGS } from './local-strings'
import { STRINGS } from './strings'

type Vars = Record<string, string | number>

// Settings translations support the existing call shapes:
// st(key), st(key, fallback), st(key, vars) or st(key, fallback, vars). {{brand}} is this app's name.
export function useSettingsT() {
  const { language } = useT()
  const st = useCallback(
    (key: string, fallback?: string | Vars, vars?: Vars) => {
      const values: Vars = { brand: 'LearnTranscriber', ...(typeof fallback === 'object' ? fallback : vars) }
      const entry = STRINGS[key] ?? LOCAL_STRINGS[key]
      const text =
        (entry && (language === 'en' ? entry.en : (entry[language] ?? entry.en))) ??
        (typeof fallback === 'string' ? fallback : key)
      return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
        name in values ? String(values[name]) : match,
      )
    },
    [language],
  )
  return { st, language }
}
