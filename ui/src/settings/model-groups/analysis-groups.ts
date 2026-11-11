import type { Settings } from '@/bridge/types/settings'
import { GEMINI_ANALYSIS, OPENAI_ANALYSIS } from '../model-catalog'
import { openaiCards, openaiDescription, refusedNote, type Card, type Group, type ProviderSetup } from './cards'
import { customGroup } from './custom-group'

type Purpose = 'analysis' | 'translation'

// The provider and model a purpose saves and reads. Translation falls back to the analysis choice until it has
// its own provider.
function choice(settings: Settings, purpose: Purpose) {
  if (purpose === 'analysis')
    return { providerKey: 'provider', modelKey: 'model', provider: settings.provider, model: settings.model }
  return {
    providerKey: 'translationProvider',
    modelKey: 'translationModel',
    provider: settings.translationProvider || settings.provider,
    model: settings.translationModel || (settings.translationProvider ? '' : settings.model),
  }
}

// The Analysis or Translation groups, one per configured provider: ChatGPT sign-in, OpenAI, Gemini, OpenRouter,
// a custom endpoint and the local LLM. Translation copy is localized; analysis copy stays in English.
export function analysisGroups(setup: ProviderSetup, purpose: Purpose): Group[] {
  const { st, settings, keys, available, localLlm } = setup
  const { providerKey, modelKey, provider: activeProvider, model: activeModel } = choice(settings, purpose)
  const pick = (provider: string) => (model: Card) =>
    ({ [providerKey]: provider, [modelKey]: model.id }) as Partial<Settings>
  const is = (provider: string) => (model: Card) => activeProvider === provider && activeModel === model.id
  const translation = purpose === 'translation'
  const apiKey = translation ? st('settings.models.badge.apiKey', 'API Key') : 'API Key'
  const list: Group[] = []
  if (setup.signedIn)
    list.push({
      id: `codex-${purpose}`,
      title: translation ? st('settings.models.codexTranslationTitle', 'ChatGPT / Codex') : 'ChatGPT / Codex',
      description: translation
        ? st('settings.models.translationCodexDesc', 'Translate via your ChatGPT Sign-In Codex model.')
        : 'Agentic coding models available through ChatGPT Sign-In.',
      badge: translation ? st('settings.models.badge.codexOAuth', 'Codex OAuth') : 'Codex Auth',
      icon: 'openai',
      models: (available.chatgpt || []).map((id) => ({ id, name: id, description: '', icon: 'openai' })),
      choose: pick('chatgpt'),
      selected: is('chatgpt'),
    })
  if (keys.openai) {
    const cards = openaiCards(OPENAI_ANALYSIS, available.openai, refusedNote(setup))
    const locked = cards.filter((model) => model.unavailable).length
    list.push({
      id: `openai-${purpose}`,
      title: translation ? st('settings.models.openaiTranslationTitle', 'OpenAI API') : 'OpenAI API',
      description: translation
        ? st('settings.models.translationOpenaiDesc', 'Fast translation via OpenAI. Recommended: GPT-4o Mini.')
        : openaiDescription(setup, locked, {
            key: 'settings.models.openaiAnalysisDesc',
            fallback: 'Standard OpenAI chat and analysis models using your API key.',
          }),
      badge: apiKey,
      icon: 'openai',
      tierHint: !translation && locked > 0 && !setup.rejected?.openai,
      models: cards,
      choose: pick('openai'),
      selected: is('openai'),
    })
  }
  if (keys.gemini)
    list.push({
      id: `gemini-${purpose}`,
      title: translation ? st('settings.models.geminiTranslationTitle', 'Gemini') : 'Gemini',
      description: translation
        ? st(
            'settings.models.translationGeminiDesc',
            'Fast translation via Gemini. Recommended: Gemini 3.1 Flash-Lite.',
          )
        : 'Google Gemini models for chat and analysis.',
      badge: apiKey,
      icon: 'gemini',
      models: GEMINI_ANALYSIS.map((model) => ({ ...model, icon: 'gemini' })),
      choose: pick('gemini'),
      selected: is('gemini'),
    })
  if (keys.openrouter) {
    const routed = activeProvider === 'openrouter' ? activeModel : ''
    list.push({
      id: `openrouter-${purpose}`,
      title: translation ? st('settings.models.openrouterTranslationTitle', 'OpenRouter') : 'OpenRouter',
      description: translation
        ? st('settings.models.translationOpenrouterDesc', 'Route translation through OpenRouter.')
        : 'Gateway access to third-party models.',
      badge: apiKey,
      icon: 'openrouter',
      models: [
        {
          id: 'openrouter',
          name: 'OpenRouter',
          description:
            routed || st('settings.models.openrouterFallbackDesc', 'Access many models through OpenRouter API'),
          icon: 'openrouter',
        },
      ],
      // OpenRouter keeps its routed model; choosing the card selects the provider.
      choose: () => ({ [providerKey]: 'openrouter', [modelKey]: routed || settings.model }) as Partial<Settings>,
      selected: () => activeProvider === 'openrouter',
    })
  }
  if ((settings.customBaseUrl || '').trim()) list.push(customGroup(setup, purpose, pick('custom'), is('custom')))
  if (localLlm.length)
    list.push({
      id: `local-${purpose}`,
      title: translation ? st('settings.models.localTranslationTitle', 'Local LLM') : 'Local LLM',
      description: translation
        ? st('settings.models.translationLocalDesc', 'Translate on-device with your local LLM.')
        : 'On-device models for private analysis and chat.',
      badge: 'On Device',
      icon: 'local',
      models: localLlm.map((model) => ({
        id: model.id,
        name: model.name,
        description: 'Local LLM model',
        icon: 'local',
      })),
      choose: () => ({ [providerKey]: 'local' }) as Partial<Settings>,
      selected: (model) =>
        activeProvider === 'local' && (setup.llmRuntime ? setup.llmRuntime === model.id : model.id === localLlm[0]?.id),
      local: (model) => model.id,
    })
  return list
}
