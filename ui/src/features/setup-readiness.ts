import { modelReady } from './model-setup'
import type { PublicState } from '@/bridge/types/state'

// Configuration checks only: no permission request, recording, download or provider call runs here.
export function setupReadiness(state: PublicState) {
  const { settings, localModels, credentials } = state
  const credential = (provider: string) => Boolean(credentials[provider])
  const local = (kind: string) => localModels.models.some((model) => model.kind === kind && model.available)
  const model = modelReady(state)
  const source =
    settings.transcriptionProvider === 'apple'
      ? Boolean(settings.appleSpeechLocale)
      : settings.transcriptionProvider === 'local'
        ? local('whisper') && Boolean(localModels.binaries.whisper)
        : settings.transcriptionProvider === 'custom'
          ? Boolean(settings.transcriptionBaseUrl && settings.transcriptionModel)
          : credential(settings.transcriptionProvider)
  return {
    model,
    audio: source && state.permissions.microphone === 'granted',
    // The onboarding asks which built-ins to keep before the assistant step counts as done.
    assistant:
      settings.assistantsChosen &&
      state.assistants.some((assistant) => assistant.id === settings.assistantId && Boolean(assistant.prompt.trim())),
  }
}
