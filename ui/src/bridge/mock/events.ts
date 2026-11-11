import type { GenerationApi } from '../types/generation'
import type { Unsubscribe } from '../types/subscription'
import type { LocalState } from '../types/local-models'
import type { PublicState } from '../types/state'
import type { UpdateStatus } from '../types/updates'

// A minimal pub/sub so each event has its own list of listeners, the way the native app's IPC channels do.
function hub<T>() {
  const listeners = new Set<(value: T) => void>()
  return {
    emit(value: T) {
      for (const listener of listeners) listener(value)
    },
    subscribe(listener: (value: T) => void): Unsubscribe {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

// One hub per main-process event the renderer listens to.
export function createMockEvents() {
  return {
    changes: hub<PublicState>(),
    actions: hub<string>(),
    questionDrafts: hub<string>(),
    deltas: hub<{ requestId: string; delta: string }>(),
    overlayDeltas: hub<Parameters<Parameters<GenerationApi['onOverlayDelta']>[0]>[0]>(),
    overlayAnswers: hub<Parameters<Parameters<GenerationApi['onOverlayAnswer']>[0]>[0]>(),
    overlayFinished: hub<Parameters<Parameters<GenerationApi['onOverlayFinished']>[0]>[0]>(),
    localChanges: hub<LocalState>(),
    runtimeChanges: hub<{ kind: string; progress: string }[]>(),
    updateChanges: hub<UpdateStatus>(),
    selections: hub<{ text: string; sessionId: string; application?: string }>(),
    systemAudio: hub<{ sessionId: string; speaker: string; mime: string; bytes: ArrayBuffer }>(),
    systemAudioErrors: hub<string>(),
    integrationErrors: hub<string>(),
  }
}
export type MockEvents = ReturnType<typeof createMockEvents>
