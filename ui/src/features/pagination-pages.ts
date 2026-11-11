// Keep the current page reachable without rendering every page in a large library.
export function paginationPages(page: number, count: number): number[] {
  if (count < 1) return []
  const width = Math.min(count, 5)
  const start = Math.max(1, Math.min(page - 2, count - width + 1))
  return Array.from({ length: width }, (_, index) => start + index)
}
