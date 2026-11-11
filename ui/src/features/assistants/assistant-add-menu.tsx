import { ChevronDown, FileUp, LibraryBig, Sparkles } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'

const ITEM = 'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none focus:bg-accent'

// The other ways to add an assistant, behind one menu so creating one stays the page's only primary action.
export function AssistantAddMenu({ onBuild }: { onBuild: () => void }) {
  const ws = useWorkspace()
  const { t } = useT()
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="default" className="gap-2">
          {t('assistants.moreWays')}
          <ChevronDown aria-hidden="true" className="size-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          collisionPadding={12}
          avoidCollisions
          style={{
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'var(--radix-dropdown-menu-content-available-height)',
            overflowY: 'auto',
          }}
          sideOffset={6}
          className="z-50 grid min-w-56 gap-1 rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
        >
          <DropdownMenu.Item className={ITEM} onSelect={onBuild}>
            <Sparkles className="size-4" aria-hidden="true" />
            {t('assistants.build')}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={ITEM} onSelect={() => ws.setDialog({ type: 'assistant-import' })}>
            <FileUp className="size-4" aria-hidden="true" />
            {t('assistants.import')}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={ITEM} onSelect={() => ws.go('assistants/choose')}>
            <LibraryBig className="size-4" aria-hidden="true" />
            {t('builtIns.open')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
