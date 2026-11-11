export const PROVIDER_IDS = ['local', 'apple_speech', 'openai', 'gemini', 'openrouter', 'custom'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

// The provider page named in #settings/api/<section>; anything else falls back to the provider grid.
export function providerFromSection(section: string | null): ProviderId | null {
  return PROVIDER_IDS.find((id) => id === section) ?? null
}
