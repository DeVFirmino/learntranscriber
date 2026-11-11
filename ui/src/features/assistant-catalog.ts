import type { Assistant } from '@/bridge/types/assistants'
import { resolveCategory } from '../assistant-categories'

// The main process seeds these by id (src/main/domain/assistants/built-in-catalog.cjs); a test keeps both lists equal.
// Built-ins carry no source badge.
export const BUILT_IN_IDS = ['general', 'math', 'english', 'programming', 'meeting']

export function isBuiltIn(assistant: Pick<Assistant, 'id'>) {
  return BUILT_IN_IDS.includes(assistant.id)
}

export function categoryOf(assistant: Assistant) {
  return resolveCategory(assistant, isBuiltIn(assistant)).label
}

export function sourceOf(assistant: Assistant) {
  return isBuiltIn(assistant) ? '' : 'Custom'
}

// Every category in use with its number of assistants, in alphabetical order.
export function categoryCounts(assistants: Assistant[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const assistant of assistants) {
    const name = categoryOf(assistant)
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b))
}

// The assistants in the chosen category ('all' for every one) whose name, category, source or prompt contains the
// search text, sorted by name.
export function filterAssistants(assistants: Assistant[], filter: { query: string; category: string }) {
  const term = filter.query.trim().toLocaleLowerCase()
  return assistants
    .filter((assistant) => {
      const category = categoryOf(assistant)
      if (filter.category !== 'all' && filter.category !== category) return false
      if (!term) return true
      return [assistant.name, category, sourceOf(assistant), assistant.prompt].some((value) =>
        value.toLocaleLowerCase().includes(term),
      )
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export interface ListPage<T> {
  items: T[]
  page: number
  pageCount: number
  // 1-based positions of the first and last item shown, for "Showing 1 to 8 of 20"; both are 0 for an empty list.
  first: number
  last: number
}

// One page of a list. A page past the end shows the last page, so shrinking the list never leaves an empty page.
export function paginate<T>(items: T[], size: number, page: number): ListPage<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(page, pageCount)
  const start = (current - 1) * size
  return {
    items: items.slice(start, start + size),
    page: current,
    pageCount,
    first: items.length ? start + 1 : 0,
    last: Math.min(start + size, items.length),
  }
}
