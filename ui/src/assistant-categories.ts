export const CATEGORY_IDS = [
  'general',
  'sales',
  'support',
  'meetings',
  'translation',
  'research',
  'coaching',
  'writing',
  'engineering',
  'education',
  'memory',
] as const
export type CategoryId = (typeof CATEGORY_IDS)[number]

interface CategoryRule {
  name: string
  aliases: string[]
  keywords: string[]
}

// Original local vocabulary: aliases canonicalize labels; keywords infer a missing category.
const RULES: Record<CategoryId, CategoryRule> = {
  general: { name: 'General', aliases: ['default', 'geral', 'general purpose'], keywords: [] },
  sales: {
    name: 'Sales',
    aliases: ['sale', 'vendas', 'ventas', 'selling'],
    keywords: ['sales', 'prospect', 'pipeline', 'deal', 'objection', 'quota', 'lead'],
  },
  support: {
    name: 'Support',
    aliases: ['customer support', 'suporte', 'soporte', 'help desk', 'helpdesk'],
    keywords: ['support', 'ticket', 'troubleshoot', 'customer issue', 'refund', 'escalation'],
  },
  meetings: {
    name: 'Meetings',
    aliases: ['meeting', 'reuniões', 'reunioes', 'reuniones', 'notes'],
    keywords: ['meeting', 'agenda', 'action item', 'minutes', 'standup', 'decisions'],
  },
  translation: {
    name: 'Translation',
    aliases: ['translate', 'translator', 'tradução', 'traducao', 'traducción', 'traduccion'],
    keywords: ['translate', 'translation', 'interpreter', 'bilingual'],
  },
  research: {
    name: 'Research',
    aliases: ['pesquisa', 'investigación', 'investigacion', 'analysis'],
    keywords: ['research', 'sources', 'literature', 'hypothesis', 'evidence review'],
  },
  coaching: {
    name: 'Coaching',
    aliases: ['coach', 'mentoring', 'mentor', 'mentoria'],
    keywords: ['coach', 'mentor', 'feedback on my', 'practice', 'mock interview', 'interview'],
  },
  writing: {
    name: 'Writing',
    aliases: ['writer', 'escrita', 'escritura', 'copywriting'],
    keywords: ['write', 'draft an', 'edit my', 'blog', 'essay', 'copy', 'tone of voice'],
  },
  engineering: {
    name: 'Engineering',
    aliases: ['engineer', 'development', 'dev', 'programming', 'engenharia', 'ingeniería', 'ingenieria'],
    keywords: ['code', 'debug', 'architecture', 'api', 'software', 'pull request', 'stack trace'],
  },
  education: {
    name: 'Education',
    aliases: ['study', 'learning', 'educação', 'educacao', 'educación', 'educacion', 'teaching'],
    keywords: ['learn', 'study', 'explain', 'lesson', 'student', 'quiz', 'exam'],
  },
  memory: {
    name: 'Memory',
    aliases: ['history', 'memória', 'memoria', 'recall'],
    keywords: ['remember', 'history', 'past sessions', 'recall'],
  },
}

export interface CategorySource {
  id?: string
  name?: string
  category?: string | null
  prompt?: string
  context?: string
  follow_up_prompt?: string
  email_prompt?: string
}

const normalize = (value: string) => value.trim().toLocaleLowerCase()

export function canonicalCategory(value: string | null | undefined): CategoryId | null {
  const wanted = normalize(value || '')
  if (!wanted) return null
  for (const id of CATEGORY_IDS) {
    const rule = RULES[id]
    if (wanted === id || wanted === normalize(rule.name) || rule.aliases.some((alias) => normalize(alias) === wanted))
      return id
  }
  return null
}

export function inferCategory(source: CategorySource): CategoryId | null {
  const text = normalize(
    [source.name, source.prompt, source.context, source.follow_up_prompt, source.email_prompt]
      .filter(Boolean)
      .join('\n'),
  )
  if (!text) return null
  for (const id of CATEGORY_IDS)
    if (
      RULES[id].keywords.some((keyword) =>
        new RegExp(`(^|[^\\p{L}\\p{N}])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(text),
      )
    )
      return id
  return null
}

/** Resolved category: canonical id for known labels, the custom label as written, or an inferred/fallback category. */
export function resolveCategory(source: CategorySource, builtIn: boolean): { id: CategoryId | null; label: string } {
  const written = (source.category || '').trim()
  const canonical = canonicalCategory(written)
  if (canonical) return { id: canonical, label: RULES[canonical].name }
  if (written && normalize(written) !== 'uncategorized') return { id: null, label: written }
  const inferred = inferCategory(source)
  if (inferred) return { id: inferred, label: RULES[inferred].name }
  return builtIn ? { id: 'general', label: RULES.general.name } : { id: null, label: 'Uncategorized' }
}
