import { documentT, type MessageKey } from '@/i18n'
import { en } from '@/locales/en'

export function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(document.documentElement.lang || undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

// Main-process and audio errors arrive in English; known messages are shown in the interface language.
const knownMessages = new Map(
  Object.entries(en)
    .filter(([key]) => key.startsWith('error.'))
    .map(([key, value]) => [value, key as MessageKey]),
)

export function localizeMessage(text: string) {
  if (text === 'Continue with ChatGPT in AI sources first.') return documentT('error.connectAiModel')
  const key = knownMessages.get(text)
  return key ? documentT(key) : text
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? localizeMessage(error.message) : documentT('error.somethingWentWrong')
}

export function isSafeScreenshot(value: string) {
  return /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)
}
