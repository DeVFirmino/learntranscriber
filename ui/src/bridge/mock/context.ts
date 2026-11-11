import type { CaptureState, ContextApi } from '../types/context'
import type { MockContext } from './state'

export function contextApi(ctx: MockContext) {
  const { state, selections, previewPng } = ctx
  const captureListeners = new Set<(value: CaptureState) => void>()
  const captureState = (phase: CaptureState['phase']) => captureListeners.forEach((listener) => listener({ phase }))
  const api: ContextApi = {
    contextStatus: async () => ({ trusted: false }),
    contextPermission: async () => true,
    selectedText: async () => {
      if (!state.activeSessionId) throw new Error('Start a session before reading selected text.')
      return {
        text: 'Preview selection. This is sample text, not content from another app.',
        sessionId: state.activeSessionId,
        application: 'Preview',
      }
    },
    screenText: async () => {
      if (!state.activeSessionId) throw new Error('Start a session before extracting screen text.')
      return { text: 'Preview OCR. No display was captured.', sessionId: state.activeSessionId }
    },
    onSelection: selections.subscribe,
    clipboard: async () => {
      throw new Error('Browser preview does not read the system clipboard.')
    },
    clipboardImage: async () => null,
    screens: async () => [{ id: 'preview-display', label: 'Preview display · not your screen' }],
    onCaptureState: (listener) => {
      captureListeners.add(listener)
      return () => {
        captureListeners.delete(listener)
      }
    },
    capture: async () => {
      captureState('capturing')
      try {
        const image = await previewPng()
        captureState('captured')
        return image
      } catch (error) {
        captureState('error')
        throw error
      }
    },
  }
  return api
}
