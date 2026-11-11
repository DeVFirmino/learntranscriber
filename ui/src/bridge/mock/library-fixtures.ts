import type { Assistant } from '../types/assistants'
import type { SessionDetail } from '../types/sessions'

// The preview's library: the built-in catalog with short stand-in prompts and one custom assistant, a finished study
// session with an answer and an open planning session. None of it is real data.
const BUILT_INS: [string, string, string][] = [
  ['general', 'General Assistant', 'General'],
  ['math', 'Math Assistant', 'Education'],
  ['english', 'English Assistant', 'Education'],
  ['programming', 'Programming Assistant', 'Education'],
  ['meeting', 'Note Taker', 'Meetings'],
]

export function previewBuiltIns() {
  return BUILT_INS.map(([id, name, category]) => ({ id, name, category }))
}

export function previewBuiltIn(id: string): Assistant | undefined {
  const found = BUILT_INS.find(([builtInId]) => builtInId === id)
  if (!found) return undefined
  const [, name, category] = found
  return { id, name, category, prompt: `Preview stand-in for the ${name} system prompt.` }
}

export function previewAssistants(): Assistant[] {
  return [
    ...BUILT_INS.map(([id]) => previewBuiltIn(id) as Assistant),
    {
      id: 'notes',
      name: 'Study notes',
      prompt: 'Turn the transcript into short study notes. Keep uncertainty visible. Do not invent decisions.',
    },
  ]
}

export function previewSessions() {
  const study: SessionDetail = {
    id: 'preview-study',
    title: 'Study group · recursion',
    assistant_id: 'general',
    started_at: '2026-10-18T15:04:00.000Z',
    ended_at: '2026-10-18T15:40:00.000Z',
    summary: 'The group agreed to write the base case before the recursive call and to test it with an empty list.',
    translation: '',
    provider: 'custom',
    model: 'preview-model',
    analysis_model_source: 'custom',
    transcription_model: 'preview-whisper',
    assistant_name: 'General Assistant',
    entries: [
      {
        id: 'e1',
        session_id: 'preview-study',
        kind: 'transcript',
        speaker: 'THEY',
        content: 'Can we state the base case before the recursive call?',
        created_at: '2026-10-18T15:06:00.000Z',
      },
      {
        id: 'e2',
        session_id: 'preview-study',
        kind: 'transcript',
        speaker: 'ME',
        content: 'Yes. We will test the empty list first, then one nested list.',
        created_at: '2026-10-18T15:08:00.000Z',
      },
      {
        id: 'e3',
        session_id: 'preview-study',
        kind: 'user',
        speaker: '',
        content: 'What did we decide to test?',
        created_at: '2026-10-18T15:20:00.000Z',
      },
      {
        id: 'e4',
        session_id: 'preview-study',
        kind: 'assistant',
        speaker: '',
        content:
          'You decided to test the empty list first, then one nested list. The base case comes before the recursive call.',
        created_at: '2026-10-18T15:20:08.000Z',
      },
    ],
    context: [],
  }
  const planning: SessionDetail = {
    id: 'preview-plan',
    title: 'Planning notes · preview',
    assistant_id: 'notes',
    started_at: '2026-10-19T18:12:00.000Z',
    ended_at: null,
    summary: '',
    translation: '',
    provider: 'custom',
    model: 'preview-model',
    analysis_model_source: 'custom',
    transcription_model: 'preview-whisper',
    assistant_name: 'Study notes',
    entries: [
      {
        id: 'e5',
        session_id: 'preview-plan',
        kind: 'transcript',
        speaker: 'ME',
        content: 'Leave the overlay off until the session is resumed on purpose.',
        created_at: '2026-10-19T18:14:00.000Z',
      },
    ],
    context: [],
  }
  return { study, planning }
}
