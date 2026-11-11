import { ListPagination } from '@/components/ui/list-pagination'

// Session search uses zero-based pages; the shared control displays one-based pages.
export function PaginationFooter({
  page,
  onPage,
  ...props
}: {
  page: number
  pageCount: number
  from: number
  to: number
  total: number
  onPage: (page: number) => void
}) {
  return <ListPagination {...props} page={page + 1} onPage={(number) => onPage(number - 1)} />
}
