import { Search } from 'lucide-react'
import { BorderBeam } from './border-beam-search'
import { useT } from '@/use-t'

export default function BorderBeamSearchDemo() {
  const { t } = useT()
  return (
    <div className="flex min-h-90 w-full max-w-150 items-center justify-center rounded-2xl bg-background p-6">
      <BorderBeam size="line" colorVariant="colorful" duration={3.1} borderRadius={20} className="max-w-full">
        <div className="relative flex h-10.5 w-91.5 max-w-full items-center gap-2.5 overflow-hidden rounded-[20px] bg-surface px-3 text-muted-foreground">
          <Search aria-hidden="true" className="size-5 shrink-0" />
          <span className="text-sm">{t('assistants.search')}</span>
        </div>
      </BorderBeam>
    </div>
  )
}
