const KEY_URLS: Record<string, string> = {
  openai: 'https://platform.openai.com/api-keys',
  gemini: 'https://aistudio.google.com/apikey',
  openrouter: 'https://openrouter.ai/keys',
}

export function providerKeyUrl(provider: string): string | undefined {
  return Object.hasOwn(KEY_URLS, provider) ? KEY_URLS[provider] : undefined
}
