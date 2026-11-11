import type { WindowsApi } from '../types/windows'
import type { MockContext } from './state'

export function windowsApi(ctx: MockContext) {
  const { state, settings, actions, emit, setOverlay } = ctx
  const api: WindowsApi = {
    onQuestionDraft: (listener) => ctx.questionDrafts.subscribe(listener),
    openQuestion: async (question) => {
      if (typeof question !== 'string' || question.length > 20000) throw new Error('Invalid question draft.')
      state.overlayExpanded = true
      const url = new URL(window.location.href)
      url.searchParams.delete('surface')
      window.history.replaceState({}, '', url)
      setOverlay(true)
      emit()
      window.setTimeout(() => ctx.questionDrafts.emit(question), 100)
      return true
    },
    presentOnboarding: async (active) => {
      if (typeof active !== 'boolean') throw new Error('Invalid onboarding presentation.')
      return true
    },
    showMain: async () => {
      setOverlay(false)
      return true
    },
    openAiModels: async () => {
      setOverlay(false)
      window.setTimeout(() => actions.emit('openAiModels'), 0)
      return true
    },
    openAiSources: async () => {
      setOverlay(false)
      window.setTimeout(() => actions.emit('openAiSources'), 0)
      return true
    },
    expandNotch: async (expanded) => {
      state.notchExpanded = expanded
      state.notchBounds = expanded
        ? { x: 312, y: 8, width: settings.notchWidth, height: settings.notchHeight }
        : { x: 470, y: 8, width: 84, height: 48 }
      emit()
      return true
    },
    displayNotchInsight: async () => false,
    setNotchInteractive: async () => true,
    moveNotch: async ({ x, y, commit }) => {
      state.notchBounds = { ...state.notchBounds, x: Math.round(x), y: Math.round(y) }
      if (commit) {
        settings.notchPinned = false
        settings.notchX = state.notchBounds.x
        settings.notchY = state.notchBounds.y
        emit()
      }
      return { ...state.notchBounds }
    },
    resizeNotch: async ({ width, height, commit }) => {
      state.notchBounds = {
        ...state.notchBounds,
        width: Math.max(360, Math.min(900, Math.round(width))),
        height: Math.max(160, Math.min(640, Math.round(height))),
      }
      if (commit) {
        settings.notchWidth = state.notchBounds.width
        settings.notchHeight = state.notchBounds.height
        emit()
      }
      return { ...state.notchBounds }
    },
    hide: async () => {
      state.concealed = true
      emit()
      return true
    },
    restore: async () => {
      state.concealed = false
      emit()
      return true
    },
    showOverlay: async (expanded = false) => {
      if (typeof expanded !== 'boolean') throw new Error('Invalid floating assistant request.')
      if (expanded) {
        state.overlayExpanded = true
        const url = new URL(window.location.href)
        url.searchParams.delete('surface')
        window.history.replaceState({}, '', url)
        emit()
      }
      setOverlay(true)
      if (expanded) window.setTimeout(() => actions.emit('showResponse'), 0)
      return true
    },
    toggleOverlay: async () => {
      setOverlay(new URL(window.location.href).searchParams.get('window') !== 'overlay')
      return true
    },
    setBarPopoverOpen: async (open) => {
      if (typeof open !== 'boolean') throw new Error('Invalid bar popover request.')
      return true
    },
    expandOverlay: async (expanded) => {
      state.overlayExpanded = expanded
      emit()
      return true
    },
    resizeOverlay: async () => true,
    openAudioSources: async () => {
      window.location.hash = 'settings/general'
      return true
    },
    closeOverlay: async () => {
      setOverlay(false)
      return true
    },
  }
  return api
}
