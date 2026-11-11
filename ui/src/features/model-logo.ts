import type { SettingsIconName } from '../settings/icons/glyphs'

export function modelLogo(kind: string, name: string, vision: boolean): SettingsIconName {
  if (kind === 'whisper') return 'model-whisper'
  if (/^qwen[\s\d.-]/i.test(name)) return 'model-qwen'
  if (/^gemma[\s\d.-]/i.test(name)) return 'model-gemma'
  return vision ? 'model-vision' : 'model-text'
}
