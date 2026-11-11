// The Models tab catalogs, as packaged. This build has no remote configuration, so it always uses this packaged list.
export type CatalogModel = { id: string; name: string; description: string; new?: boolean }

export const OPENAI_ANALYSIS: CatalogModel[] = [
  {
    id: 'gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    description: 'Flagship model for the most demanding reasoning and agentic work.',
    new: true,
  },
  {
    id: 'gpt-5.6-terra',
    name: 'GPT-5.6 Terra',
    description: 'Balanced model for high-quality general analysis and multimodal work.',
    new: true,
  },
  {
    id: 'gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    description: 'Fast, efficient model for responsive and high-volume features.',
    new: true,
  },
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    description: 'Best intelligence at scale for agentic, coding, and professional workflows.',
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    description: 'OpenAI strongest mini model yet for coding, computer use, and subagents.',
  },
  {
    id: 'gpt-5.4-nano',
    name: 'GPT-5.4 Nano',
    description: 'OpenAI cheapest GPT-5.4-class model for simple high-volume tasks.',
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'Improvements in coding, instruction following, and long-context tasks.',
  },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Versatile multimodal model for text, vision, and audio.' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Faster, cost-efficient variant of GPT-4o.' },
]

export const OPENAI_TRANSCRIPTION: CatalogModel[] = [
  { id: 'gpt-live-transcribe', name: 'GPT Live Transcribe', description: '', new: true },
  {
    id: 'gpt-realtime-whisper',
    name: 'GPT Realtime Whisper',
    description: 'Low-latency model for realtime transcript deltas.',
  },
  {
    id: 'gpt-4o-transcribe',
    name: 'GPT-4o Transcribe',
    description: 'Higher-accuracy speech-to-text when streaming is not required.',
  },
  {
    id: 'gpt-4o-mini-transcribe',
    name: 'GPT-4o Mini Transcribe',
    description: 'Faster and cost-effective transcription.',
  },
]

export const GEMINI_ANALYSIS: CatalogModel[] = [
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    description: 'Frontier Gemini model optimized for agentic and coding tasks.',
    new: true,
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    description: 'Advanced reasoning model for complex problem solving and tool-heavy workflows.',
    new: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    description: 'Low-latency, cost-effective Gemini model for high-volume lightweight tasks.',
    new: true,
  },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Balanced speed and capability for most tasks.' },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Fast and lightweight Gemini model for quick tasks.',
  },
]

// USD per audio minute per stream, for the estimated 30-minute two-source call.
export const TRANSCRIPTION_COST: Record<string, number> = {
  'gpt-live-transcribe': 0.017,
  'gpt-realtime-whisper': 0.017,
  'gpt-transcribe': 0.0045,
  'gpt-4o-transcribe': 0.006,
  'gpt-4o-mini-transcribe': 0.003,
}
