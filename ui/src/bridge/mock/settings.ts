import type { Settings, SettingsApi } from '../types/settings'
import type { StateApi } from '../types/state'
import type { MockContext } from './state'
import { validateEndpoint } from './input-validation'

// Settings, keys and custom headers. Validation mirrors the native rules closely but not exactly; see the contract fixtures.
export function settingsApi(ctx: MockContext) {
  const { state, settings, credentials, sessions, accounts, publicState, emit, changes } = ctx
  const api: SettingsApi & StateApi = {
    state: async () => publicState(),
    onChange: changes.subscribe,
    settings: async (patch) => {
      for (const [key, value] of Object.entries(patch) as [keyof Settings, Settings[keyof Settings]][]) {
        if (!(key in settings)) throw new Error(`Unknown setting: ${key}`)
        if (typeof value !== typeof settings[key]) throw new Error(`Invalid value for ${key}.`)
        if (key === 'onboardingAudioSource' && !['', 'microphone', 'computer'].includes(String(value)))
          throw new Error('Choose microphone or computer audio.')
        if (
          key === 'workspaceZoom' &&
          (typeof value !== 'number' || !Number.isInteger(value) || value < 70 || value > 150 || value % 10 !== 0)
        )
          throw new Error('Workspace zoom must be between 70% and 150% in 10% steps.')
        if (typeof value === 'string' && value.length > 2000) throw new Error(`Setting ${key} is too long.`)
        if (
          key === 'systemAudioSource' &&
          !['native', 'process-tap', 'electron', 'input-device'].includes(String(value))
        )
          throw new Error('Choose a supported incoming audio source.')
        if (
          key === 'provider' &&
          !['openai', 'gemini', 'openrouter', 'custom', 'local', 'chatgpt'].includes(String(value))
        )
          throw new Error('Unsupported provider.')
        if (
          key === 'translationProvider' &&
          !['', 'openai', 'gemini', 'openrouter', 'custom', 'local', 'chatgpt'].includes(String(value))
        )
          throw new Error('Unsupported translation provider.')
        if (
          key === 'transcriptionProvider' &&
          !['apple', 'openai', 'gemini', 'custom', 'local'].includes(String(value))
        )
          throw new Error('Unsupported transcription provider.')
        if (key === 'overlayOpacity' && (typeof value !== 'number' || value < 0.25 || value > 1))
          throw new Error('Opacity must be between 25% and 100%.')
        if (key === 'uiLanguage' && !['', 'en', 'es', 'pt-BR'].includes(String(value)))
          throw new Error('Choose a supported interface language.')
        if (key === 'surfaceTheme' && value !== 'dark' && value !== 'light')
          throw new Error('Choose a dark or light surface.')
        if (
          key === 'notchOpacity' &&
          (typeof value !== 'number' || !Number.isFinite(value) || value < 0.45 || value > 1)
        )
          throw new Error('Notch opacity must be between 45% and 100%.')
        if (
          key === 'unifiedModalFontScale' &&
          (typeof value !== 'number' ||
            !Number.isFinite(value) ||
            value < 0.7 ||
            value > 1.6 ||
            Math.abs(value * 10 - Math.round(value * 10)) > 0.00001)
        )
          throw new Error('Floating font size must be between 70% and 160% in 10% steps.')
        if (key.endsWith('BaseUrl') && typeof value === 'string' && !(key === 'customBaseUrl' && value === ''))
          validateEndpoint(value)
      }
      Object.assign(settings, patch)
      if (state.activeSessionId && (Object.hasOwn(patch, 'provider') || Object.hasOwn(patch, 'model'))) {
        const active = sessions.get(state.activeSessionId)
        if (active) {
          active.provider = settings.provider
          active.model = settings.model || null
          active.analysis_model_source = settings.provider
        }
      }
      emit()
      return publicState()
    },
    saveCustomHeaders: async (input) => {
      const previous = new Map(state.customHeaders.map((item) => [item.key.toLowerCase(), item.value]))
      state.customHeaders = input.map((item) => {
        const value = item.value ?? previous.get(item.key.toLowerCase())
        if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,100}$/.test(item.key) || typeof value !== 'string')
          throw new Error('Invalid custom header.')
        return { key: item.key, value }
      })
      emit()
      return state.customHeaders.map((item) => item.key)
    },
    saveKey: async (input) => {
      if (input.provider === 'chatgpt') throw new Error('Use Continue with ChatGPT to manage account access.')
      if (typeof input.key !== 'string' || input.key.length > 20000) throw new Error('Invalid key.')
      if (input.key.trim()) credentials[input.provider] = true
      else delete credentials[input.provider]
      input.key = ''
      emit()
      return { ...credentials }
    },
    models: async (provider = settings.provider) => {
      if (provider === 'chatgpt') {
        if (!accounts.some((account) => account.authenticated && account.id === state.activeAccount))
          throw new Error('Continue with ChatGPT in AI sources first.')
        return ['preview-chatgpt-model']
      }
      if (provider === 'local') return ['preview-local-model']
      if (provider !== 'custom' && !credentials[provider])
        throw new Error('Add an API key first. This preview does not contact a provider.')
      return ['preview-model']
    },
  }
  return api
}
