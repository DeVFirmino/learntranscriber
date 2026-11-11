import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandMark, BrandName } from '@/components/brand'
import { useT } from '@/use-t'

// The workspace header: the brand back to Home. Navigation, Settings and Hide live in the left navigation.
export function WorkspaceHeader({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t } = useT()
  return (
    <header className="workspace-header">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="workspace-nav-toggle"
        aria-label={t(collapsed ? 'nav.expand' : 'nav.collapse')}
        aria-expanded={!collapsed}
        aria-controls="workspace-navigation"
        onClick={onToggle}
      >
        {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
      </Button>
      <a
        href="#home"
        aria-label={t('app.home')}
        className="workspace-header-brand flex shrink-0 items-center gap-2 text-sm tracking-tight"
      >
        <BrandMark />
        <span className="workspace-brand-name">
          <BrandName />
        </span>
      </a>
    </header>
  )
}
