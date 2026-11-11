import { ChevronLeft, ChevronRight } from 'lucide-react'
import { paginationPages } from '@/features/pagination-pages'
import { useT } from '@/use-t'
import { Button } from './button'

export function ListPagination({
  page,
  pageCount,
  from,
  to,
  total,
  onPage,
}: {
  page: number
  pageCount: number
  from: number
  to: number
  total: number
  onPage: (page: number) => void
}) {
  const { t } = useT()
  if (!total) return null
  return (
    <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
      <span role="status">{t('sessions.showing', { from, to, total })}</span>
      <nav
        aria-label={t('sessions.page', { page, count: pageCount })}
        className="flex max-w-full flex-wrap items-center gap-1 rounded-full border border-border bg-muted/30 p-1"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          disabled={page <= 1}
          aria-label={t('common.previous')}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        {paginationPages(page, pageCount).map((number) => (
          <Button
            key={number}
            type="button"
            size="icon-sm"
            variant={number === page ? 'default' : 'ghost'}
            className="rounded-full tabular-nums"
            aria-current={number === page ? 'page' : undefined}
            aria-label={t('assistants.pageLabel', { page: number })}
            onClick={() => onPage(number)}
          >
            {number}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          disabled={page >= pageCount}
          aria-label={t('common.next')}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </nav>
    </footer>
  )
}
