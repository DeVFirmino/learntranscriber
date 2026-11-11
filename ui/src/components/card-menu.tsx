import type { ComponentType, SVGProps } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { Button } from '@/components/ui/button'

export interface CardMenuItem {
  id: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  onSelect: () => void
  destructive?: boolean
}

const MENU_ITEM = 'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none focus:bg-accent'

// The "…" menu at the top right of a library card.
export function CardMenu({ label, title, items }: { label: string; title: string; items: CardMenuItem[] }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0" aria-label={label} title={title}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 grid min-w-44 gap-1 rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
        >
          {items.map(({ id, label: itemLabel, icon: Icon, onSelect, destructive }) => (
            <DropdownMenu.Item
              key={id}
              className={destructive ? `${MENU_ITEM} text-destructive` : MENU_ITEM}
              onSelect={onSelect}
            >
              <Icon className="size-4" aria-hidden="true" />
              {itemLabel}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
