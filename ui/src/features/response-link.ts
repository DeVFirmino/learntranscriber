// A link in an answer opens only as a plain web address, without credentials.
export function safeResponseLink(value: string | undefined) {
  if (!value || value.length > 2048) return undefined
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && url.hostname && !url.username && !url.password
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}
