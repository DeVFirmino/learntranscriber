import { OPENAI_TRANSCRIPTION } from '../model-catalog'
import { openaiCards, openaiDescription, refusedNote, type Group, type ProviderSetup } from './cards'

// The Transcription groups: OpenAI with a key, Gemini with a key, Apple Speech on a Mac and the downloaded local
// Whisper models. This copy stays in English except the OpenAI status.
export function transcriptionGroups(setup: ProviderSetup): Group[] {
  const { settings, keys, available, localWhisper } = setup
  const provider = settings.transcriptionProvider
  const list: Group[] = []
  if (keys.openai) {
    const cards = openaiCards(OPENAI_TRANSCRIPTION, available.openai, refusedNote(setup))
    const locked = cards.filter((model) => model.unavailable).length
    list.push({
      id: 'openai-transcription',
      title: 'OpenAI API',
      description: openaiDescription(setup, locked, {
        key: 'settings.models.openaiTranscriptionDesc',
        fallback: 'Cloud transcription models using your OpenAI API key.',
      }),
      badge: 'API Key',
      icon: 'openai',
      tierHint: locked > 0 && !setup.rejected?.openai,
      models: cards,
      choose: (model) => ({ transcriptionProvider: 'openai', transcriptionModel: model.id }),
      selected: (model) => provider === 'openai' && settings.transcriptionModel === model.id,
    })
  }
  if (keys.gemini)
    list.push({
      id: 'gemini-transcription',
      title: 'Gemini',
      description: 'Google transcription with multilingual support.',
      badge: 'API Key',
      icon: 'gemini',
      models: [
        {
          id: 'gemini_transcription',
          name: 'Gemini',
          description: 'Google AI transcription with multilingual support',
          icon: 'gemini',
        },
      ],
      choose: () => ({
        transcriptionProvider: 'gemini',
        ...(settings.transcriptionModel.startsWith('gemini-') ? {} : { transcriptionModel: 'gemini-3.8-flash' }),
      }),
      selected: () => provider === 'gemini',
    })
  if (setup.platform === 'darwin')
    list.push({
      id: 'apple-transcription',
      title: 'Apple Speech',
      description: 'On-device macOS speech recognition.',
      badge: 'On Device',
      icon: 'apple_speech',
      models: [
        {
          id: 'apple_speech',
          name: 'Apple Speech',
          description: 'On-device macOS speech recognition, no API key needed',
          icon: 'apple_speech',
        },
      ],
      choose: () => ({ transcriptionProvider: 'apple' }),
      selected: () => provider === 'apple',
    })
  if (localWhisper.length)
    list.push({
      id: 'local-transcription',
      title: 'Local Whisper',
      description: 'Runs locally without a cloud provider.',
      badge: 'On Device',
      icon: 'openai',
      models: localWhisper.map((model) => ({
        id: model.id,
        name: model.name,
        description: 'Local Whisper model',
        icon: 'openai',
      })),
      choose: () => ({ transcriptionProvider: 'local' }),
      selected: (model) =>
        provider === 'local' &&
        (setup.whisperRuntime ? setup.whisperRuntime === model.id : model.id === localWhisper[0]?.id),
      local: (model) => model.id,
    })
  return list
}
