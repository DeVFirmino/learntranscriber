import type { CatalogModel, LocalModel } from '@/bridge/types/local-models'

export interface ModelInfo {
  name: string
  description?: string
  meta: string[]
  type?: 'text' | 'vision'
  recommended?: boolean
}

// Display metadata for the built-in catalog entries, keyed by their catalog ids.
const BUILT_IN_INFO: Record<string, ModelInfo> = {
  'large-v3': {
    name: 'Whisper Large v3',
    description: 'Highest local accuracy. Slower and requires more memory.',
    meta: ['~2.9 GiB', '~4.7 GB RAM'],
    recommended: true,
  },
  'large-v3-turbo': {
    name: 'Whisper Large v3 Turbo',
    description: 'Full precision turbo. Faster high-quality fallback.',
    meta: ['~1.5 GB', '~3 GB RAM'],
  },
  'large-v3-turbo-q5_0': {
    name: 'Whisper Large v3 Turbo (Q5)',
    description: 'Legacy quantized model. Kept for existing installs.',
    meta: ['~574 MB', '~1.5 GB RAM'],
  },
  'qwen2.5-0.5b': {
    name: 'Qwen 2.5 0.5B (Instruct)',
    description: 'Ultra-lightweight text analysis. Ideal for machines with 4 GB RAM or less. No image support.',
    meta: ['~491 MB', '~1.5 GB RAM'],
    type: 'text',
  },
  'qwen2.5-1.5b': {
    name: 'Qwen 2.5 1.5B (Instruct)',
    description: 'Small and capable text analysis. Good quality for low-RAM systems. No image support.',
    meta: ['~1.12 GB', '~2.5 GB RAM'],
    type: 'text',
  },
  'qwen3-vl-2b-instruct': {
    name: 'Qwen3-VL 2B',
    description: 'Lightweight. Handles both text and image analysis. Best for low-resource machines.',
    meta: ['~1.5 GB total', '~6 GB RAM'],
    type: 'vision',
    recommended: true,
  },
  'gemma-3-4b-it': {
    name: 'Gemma 3 4B',
    description: 'Recommended default. Handles both text and image analysis.',
    meta: ['~3.3 GB total', '~8 GB RAM'],
    type: 'vision',
  },
  'gemma-3-12b-it': {
    name: 'Gemma 3 12B',
    description: 'Higher quality. Handles both text and image analysis.',
    meta: ['~8.0 GB total', '~16 GB RAM'],
    type: 'vision',
  },
}

// Accent colours by model family; the first family that matches the name wins.
const ACCENTS: [RegExp, string][] = [
  [/whisper/, '#10A37F'],
  [/gemma/, '#4285F4'],
  [/mistral/, '#FF4D4D'],
  [/llama|llava/, '#0866FF'],
  [/moondream/, '#F97316'],
  [/qwen/, '#a855f7'],
]
const DEFAULT_ACCENT = '#94A3B8'

export function accent(name: string) {
  return ACCENTS.find(([family]) => family.test(name))?.[1] ?? DEFAULT_ACCENT
}

// Installed models carry their own id; a catalog download keeps the catalog id (or at least its file hash).
export function sameModel(model: LocalModel, entry: CatalogModel) {
  return (model as LocalModel & { catalogId?: string }).catalogId === entry.id || model.sha256 === entry.sha256
}

type DescribedModel = { id: string; name: string; kind: string; vision?: boolean; projector?: unknown; sha256?: string }

// Catalog names read "Name · detail · size"; this splits them into the name, then the details on the meta line.
export function infoOf(entry: DescribedModel, catalog: CatalogModel[] = []): ModelInfo {
  const source = catalog.find((item) => sameModel(entry as LocalModel, item))
  const known = BUILT_IN_INFO[source?.id || entry.id]
  if (known) return known
  const [name, ...details] = entry.name.split(' · ')
  const info: ModelInfo = { name, meta: details.filter((item) => item !== 'Vision') }
  if (entry.kind !== 'llm') return info
  const vision = Boolean(entry.vision || entry.projector) || details.includes('Vision')
  return { ...info, type: vision ? 'vision' : 'text' }
}

const BYTE_UNITS = ['Bytes', 'KB', 'MB', 'GB']

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Bytes'
  const unit = Math.min(BYTE_UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${parseFloat((bytes / 1024 ** unit).toFixed(1))} ${BYTE_UNITS[unit]}`
}
