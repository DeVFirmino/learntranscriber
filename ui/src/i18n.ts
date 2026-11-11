import { en } from '@/locales/en'
import { es } from '@/locales/es'
import { ptBR } from '@/locales/pt-BR'

export const UI_LANGUAGES = [
  ['en', 'English'],
  ['es', 'Español'],
  ['pt-BR', 'Português (Brasil)'],
] as const
export type UiLanguage = (typeof UI_LANGUAGES)[number][0]
type Vars = Record<string, string | number>

export type MessageKey = keyof typeof en
export type Messages = Partial<Record<MessageKey, string>>

const CATALOG: Record<UiLanguage, Messages> = { en, es, 'pt-BR': ptBR }

// Exact match first, then the base language (pt-PT → pt-BR), then English.
export function normalizeLanguage(value: string | undefined | null): UiLanguage {
  const wanted = (value || '').trim().toLowerCase()
  const exact = UI_LANGUAGES.find(([code]) => code.toLowerCase() === wanted)
  if (exact) return exact[0]
  const base = wanted.split(/[-_]/)[0]
  return UI_LANGUAGES.find(([code]) => code.toLowerCase().split('-')[0] === base)?.[0] ?? 'en'
}

export function translate(language: UiLanguage, key: MessageKey | string, vars: Vars = {}) {
  const template = CATALOG[language]?.[key as MessageKey] ?? en[key as MessageKey] ?? key
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
    vars[name] === undefined ? '' : String(vars[name]),
  )
}

export function resolveLanguage(saved: string | undefined, system: string | undefined) {
  return normalizeLanguage(saved || system)
}

export function hasMessage(key: string): key is MessageKey {
  return Object.hasOwn(en, key)
}

// For modules outside React; the app shell keeps the document language current.
export function documentT(key: MessageKey, vars?: Vars) {
  return translate(normalizeLanguage(globalThis.document?.documentElement.lang), key, vars)
}
