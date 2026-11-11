export const DEMO_ASSISTANTS = ['general', 'math', 'english', 'programming', 'notes'] as const
export type DemoAssistant = (typeof DEMO_ASSISTANTS)[number]
export interface DemoSelection {
  assistant: DemoAssistant
  comparedFrom: DemoAssistant | null
}

export function selectDemoAssistant(value: string): DemoSelection {
  const assistant = DEMO_ASSISTANTS.find((id) => id === value) ?? 'general'
  return { assistant, comparedFrom: null }
}

// Comparison changes the perspective on the same transcript, never the real session's selected assistant.
export function compareDemoAssistant(selection: DemoSelection): DemoSelection {
  if (selection.comparedFrom) return { assistant: selection.comparedFrom, comparedFrom: null }
  if (selection.assistant === 'notes') return selection
  return { assistant: 'notes', comparedFrom: selection.assistant }
}
