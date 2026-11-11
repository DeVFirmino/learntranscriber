import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ToggleGroup } from 'radix-ui'
import { SearchField } from '@/components/ui/search-field'
import { SelectionTrack } from '@/components/ui/selection-track'
import './assistant-library.css'
import { useT } from '@/use-t'
import { useCategoryLabel } from './use-category-label'

// Finding an assistant: the search and the categories with their counts, six at first.
export function AssistantFilters({
  query,
  category,
  total,
  categories,
  onQuery,
  onCategory,
}: {
  query: string
  category: string
  total: number
  categories: [string, number][]
  onQuery: (query: string) => void
  onCategory: (category: string) => void
}) {
  const { t } = useT()
  const categoryLabel = useCategoryLabel()
  const [showAll, setShowAll] = useState(false)
  const choices = [
    ['all', total],
    ...categories.filter(([name], index) => showAll || index < 6 || name === category),
  ] as [string, number][]
  return (
    <div className="assistant-library-filters">
      <SearchField
        value={query}
        label={t('assistants.search')}
        clearLabel={t('assistants.clearSearch')}
        onValueChange={onQuery}
      />
      <div className="assistant-category-row">
        <ToggleGroup.Root
          type="single"
          value={category}
          onValueChange={(value) => value && onCategory(value)}
          aria-label={t('assistants.categories')}
          asChild
        >
          <SelectionTrack value={category} className="assistant-category-options">
            {choices.map(([name, count]) => (
              <ToggleGroup.Item key={name} value={name} data-selected={category === name}>
                {name === 'all' ? t('assistants.all') : categoryLabel(name)}
                <span className="assistant-category-count">{count}</span>
              </ToggleGroup.Item>
            ))}
          </SelectionTrack>
        </ToggleGroup.Root>
        {categories.length > 6 ? (
          <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>
            {showAll ? t('assistants.less') : t('assistants.more')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
