import { ShortcutKeys } from '@/components/shortcut-keys'
import { BrandStealth } from '@/components/brand-icon'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'

// Hides every window; the tooltip shows the shortcut that brings them back.
export function HideButton() {
  const ws = useWorkspace()
  const { t } = useT()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          className="workspace-nav-link gap-2 font-normal"
          onClick={() =>
            void ws.act(async () => {
              await ws.api.hide()
            })
          }
        >
          <BrandStealth aria-hidden="true" className="size-5" />
          <span className="workspace-nav-label">{t('nav.hide')}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {t('nav.hideHint')}
        <ShortcutKeys accelerator={ws.state?.privacy.shortcuts.hide || ''} />
      </TooltipContent>
    </Tooltip>
  )
}
