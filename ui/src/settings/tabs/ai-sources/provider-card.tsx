import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { ProviderIcon, SettingsIcon } from '../../settings-icon'
import type { SettingsIconName } from '../../icons/glyphs'
import { useSettingsT } from '../../use-settings-t'
import './provider-list.css'

// One source as a compact row: its logo, name and connection badge, what it is, and its action on the right.
export function ProviderCard({
  id,
  on,
  title,
  description,
  children,
}: {
  id: string
  on: boolean
  title: string
  description: string
  children: ReactNode
}) {
  const { st } = useSettingsT()
  return (
    <Item variant="outline" className="provider-row" data-connected={on || undefined}>
      <ItemMedia className="provider-row-logo">
        <ProviderIcon providerId={id} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="flex-wrap">
          {title}
          <Badge variant="outline" className="provider-row-badge">
            <span aria-hidden="true" className="provider-row-dot" />
            {on
              ? st('settings.api.cardGrid.connected', 'Connected')
              : st('settings.api.cardGrid.notConnected', 'Not Connected')}
          </Badge>
        </ItemTitle>
        <ItemDescription className="line-clamp-2">{description}</ItemDescription>
      </ItemContent>
      <ItemActions className="provider-row-actions">{children}</ItemActions>
    </Item>
  )
}

// A provider row's action, the app's outline button with its icon.
export function ProviderAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: SettingsIconName
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button type="button" variant="outline" size="sm" className="gap-2" disabled={disabled} onClick={onClick}>
      <SettingsIcon name={icon} />
      {label}
    </Button>
  )
}

// The action that opens a provider's page to set its key or endpoint.
export function KeyButton({ icon, label, onOpen }: { icon: SettingsIconName; label: string; onOpen: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onOpen}>
      <SettingsIcon name={icon} />
      {label}
      <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
    </Button>
  )
}
