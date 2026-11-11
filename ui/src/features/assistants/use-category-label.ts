import { canonicalCategory } from '@/assistant-categories'
import { useT } from '@/use-t'

// A category's name in the interface language; a category of the user's own keeps its name.
export function useCategoryLabel() {
  const { t } = useT()
  return (name: string) => {
    const id = canonicalCategory(name)
    if (id) return t(`category.${id}`)
    return name === 'Uncategorized' ? t('category.uncategorized') : name
  }
}
