// Original artwork is bundled locally; provenance and hashes live in public/brands/sources.json.
export const THIRD_PARTY_LOGOS = {
  'provider-openai': 'codex.png',
  'provider-chatgpt': 'codex.png',
  'provider-apple_speech': 'apple.png',
  'provider-ollama': 'ollama.png',
  'provider-lmstudio': 'lmstudio.svg',
  'provider-gemini': 'gemini.png',
  'provider-openrouter': 'openrouter.png',
  'model-whisper': 'codex.png',
  'model-qwen': 'qwen.png',
  'model-gemma': 'gemma.svg',
} as const

export type ThirdPartyLogoName = keyof typeof THIRD_PARTY_LOGOS

// Monochrome marks lose the white plate on dark surfaces so they read in the light tone of the app's own icons. The
// OpenAI and OpenRouter artwork is a white mark on black, so the black blends into the surface; the Apple
// and Ollama marks are black on white, so they are inverted before blending.
export const DARK_SURFACE_LOGOS: Partial<Record<ThirdPartyLogoName, 'blend' | 'invert'>> = {
  'provider-openai': 'blend',
  'provider-chatgpt': 'blend',
  'model-whisper': 'blend',
  'provider-openrouter': 'blend',
  'provider-apple_speech': 'invert',
  'provider-ollama': 'invert',
}

export function isThirdPartyLogo(name: string): name is ThirdPartyLogoName {
  return Object.hasOwn(THIRD_PARTY_LOGOS, name)
}
