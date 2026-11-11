export interface KnowledgeFile {
  name: string
  content: string
  size: number
}

export interface Assistant {
  id: string
  name: string
  prompt: string
  category?: string
  realtime_prompt?: string
  follow_up_prompt?: string
  email_prompt?: string
  context?: string
  require_certainty?: boolean
  knowledge_files?: KnowledgeFile[]
}

export interface BuilderProposal {
  tool:
    | 'save_assistant_draft'
    | 'create_assistant'
    | 'update_existing_assistant'
    | 'update_assistant_category'
    | 'delete_assistant'
    | 'use_assistant'
  args: Record<string, unknown>
  token: string
}

export interface BuilderActionResult {
  tool: BuilderProposal['tool']
  id: string
  name: string
  category?: string
}

export interface BuilderReply {
  message: string
  draft: AssistantDraft
  results: (
    | { tool: 'search_assistant_library'; assistants: { id: string; name: string; category: string }[] }
    | { tool: 'open_assistant_for_editing'; assistant: { id: string; name: string } }
  )[]
  proposals: BuilderProposal[]
  finished: boolean
}

export interface AssistantDraft {
  name: string
  category: string
  systemPrompt: string
  realtimePrompt: string
  followUpPrompt: string
  emailPrompt: string
  requireCertainty: boolean
  context?: string
  knowledgeFiles?: KnowledgeFile[]
}

export interface AssistantsApi {
  saveAssistant: (input: {
    id?: string
    name: string
    prompt: string
    category?: string
    realtimePrompt?: string
    followUpPrompt?: string
    emailPrompt?: string
    context?: string
    requireCertainty?: boolean
    knowledgeFiles?: KnowledgeFile[]
  }) => Promise<string>
  deleteAssistant: (id: string) => Promise<{ selectedAssistantId: string }>
  chooseBuiltInAssistants: (ids: string[]) => Promise<{ restored: string[]; removed: string[] }>
  exportAssistant: (id: string) => Promise<boolean>
  importAssistant: (input: string) => Promise<AssistantDraft>
  openAssistantLibrary: () => Promise<boolean>
  buildAssistant: (input: {
    requestId: string
    question: string
    draft?: AssistantDraft
    history?: { role: 'user' | 'assistant'; content: string }[]
  }) => Promise<BuilderReply>
  applyBuilderAction: (input: { proposal: BuilderProposal; draft?: AssistantDraft }) => Promise<BuilderActionResult>
}
