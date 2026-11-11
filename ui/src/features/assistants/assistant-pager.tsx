import { ListPagination } from '@/components/ui/list-pagination'

export function AssistantPager({
  first,
  last,
  ...props
}: {
  page: number
  pageCount: number
  first: number
  last: number
  total: number
  onPage: (page: number) => void
}) {
  return <ListPagination {...props} from={first} to={last} />
}
