export type LessonState = 'listening' | 'paused' | 'stopped'

export function lessonAction(state: LessonState, action: 'pause' | 'stop' | 'replay'): LessonState {
  if (action === 'replay') return 'listening'
  if (action === 'stop') return 'stopped'
  if (state === 'stopped') return state
  return state === 'paused' ? 'listening' : 'paused'
}
