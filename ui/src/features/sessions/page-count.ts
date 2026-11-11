// Pure pagination math: how many pages a total produces, and the last valid page index to clamp a stale page to.
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function lastPageIndex(total: number, pageSize: number): number {
  return Math.max(0, Math.ceil(total / pageSize) - 1)
}
