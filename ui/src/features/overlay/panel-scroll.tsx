import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowDown } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { useT } from '@/use-t'

// The keyed tab owns both its viewport and Latest state, so another tab cannot inherit a stale button.
export function PanelScroll({
  children,
  follow,
  style,
}: {
  children: ReactNode
  follow: boolean
  style: CSSProperties
}) {
  const root = useRef<HTMLDivElement>(null)
  const [atLatest, setAtLatest] = useState(true)
  const { t } = useT()
  return (
    <div ref={root} className="relative flex min-h-0 flex-1 flex-col">
      <ScrollArea
        data-panel-scroll
        follow={follow}
        onFollowChange={setAtLatest}
        className="min-h-0 flex-1"
        style={style}
      >
        <div className="px-3 py-3">{children}</div>
      </ScrollArea>
      {!atLatest ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="floating-latest"
          onClick={() => {
            const viewport = root.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
            if (viewport) viewport.scrollTop = viewport.scrollHeight
            setAtLatest(true)
          }}
        >
          <ArrowDown aria-hidden="true" />
          {t('overlay.latest')}
        </Button>
      ) : null}
    </div>
  )
}
