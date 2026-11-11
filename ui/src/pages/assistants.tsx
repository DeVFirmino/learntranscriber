import { ActionButton } from '@/components/ui/action-button'
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Empty, PageHeading } from '@/components/chrome'
import { useWorkspace } from '@/workspace'
import { AssistantBuilder } from '@/features/assistant-builder'
import { AssistantCard } from '@/features/assistants/assistant-card'
import { AssistantFilters } from '@/features/assistants/assistant-filters'
import { AssistantAddMenu } from '@/features/assistants/assistant-add-menu'
import { AssistantPager } from '@/features/assistants/assistant-pager'
import { BuiltInPicker } from '@/features/assistants/built-in-picker'
import { useT } from '@/use-t'
import { categoryCounts, filterAssistants, paginate } from '@/features/assistant-catalog'
import type { PublicState } from '@/bridge/types/state'

// One empty list for every render before the state loads, so the memos below keep their result.
const NO_ASSISTANTS: PublicState['assistants'] = []
// Two rows of three cards; the pager below moves between pages.
const PAGE_SIZE = 6

// The assistant library: choose the built-ins to keep, build, import or create one, then find, use and manage them
// page by page. The onboarding's assistant step opens the built-in chooser at #assistants/choose.
export function Assistants() {
  const ws = useWorkspace()
  const { t } = useT()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(1)
  const [builderOpen, setBuilderOpen] = useState(false)
  const assistants = ws.state?.assistants ?? NO_ASSISTANTS
  const categories = useMemo(() => categoryCounts(assistants), [assistants])
  const filtered = useMemo(() => filterAssistants(assistants, { query, category }), [assistants, category, query])
  const { items: visible, page: currentPage, pageCount, first, last } = paginate(filtered, PAGE_SIZE, page)

  if (!ws.state) return null
  return (
    <div className="assistant-library">
      <PageHeading title={t('nav.assistants')} description={t('assistants.description')}>
        <ActionButton
          icon={<Plus aria-hidden="true" className="size-4" />}
          className="gap-2"
          onClick={() => ws.setDialog({ type: 'assistant', category: category === 'all' ? 'Uncategorized' : category })}
        >
          {t('assistants.create')}
        </ActionButton>
        <AssistantAddMenu onBuild={() => setBuilderOpen((value) => !value)} />
      </PageHeading>
      {ws.route === 'assistants/choose' ? <BuiltInPicker onDone={() => ws.go('assistants')} /> : null}
      {builderOpen ? <AssistantBuilder onClose={() => setBuilderOpen(false)} /> : null}
      <AssistantFilters
        query={query}
        category={category}
        total={assistants.length}
        categories={categories}
        onQuery={(value) => {
          setQuery(value)
          setPage(1)
        }}
        onCategory={(name) => {
          setCategory(name)
          setPage(1)
        }}
      />
      {visible.length ? (
        <div className="grid items-start gap-4 min-[760px]:grid-cols-2 min-[1100px]:grid-cols-3">
          {visible.map((assistant) => (
            <AssistantCard key={assistant.id} assistant={assistant} />
          ))}
        </div>
      ) : (
        <Empty>{t('assistants.noMatch')}</Empty>
      )}
      <AssistantPager
        page={currentPage}
        pageCount={pageCount}
        first={first}
        last={last}
        total={filtered.length}
        onPage={setPage}
      />
    </div>
  )
}
