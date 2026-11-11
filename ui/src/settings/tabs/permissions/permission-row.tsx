import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useT } from '@/use-t'
import { SettingsIcon } from '../../settings-icon'
import type { SettingsIconName } from '../../icons/glyphs'

// Permission actions keep their native request and System Settings paths.
export function PermissionRow({
  icon,
  granted,
  label,
  description,
  actionLabel,
  actionIcon,
  actionDisabled = false,
  onClick,
}: {
  icon: SettingsIconName
  granted: boolean
  label: string
  description: string
  actionLabel: string
  actionIcon?: SettingsIconName
  actionDisabled?: boolean
  onClick: () => void
}) {
  const { t } = useT()
  const shown = actionIcon || (granted ? 'open_in_new' : 'lock_open')
  return (
    <li className="permission-row">
      <SettingsIcon name={icon} className="permission-row-icon" />
      <div className="permission-row-copy">
        <h3 className="permission-row-name">{label}</h3>
        <p className="permission-row-description" title={description}>
          {description}
        </p>
      </div>
      <Badge className="permission-row-status" variant={granted ? 'default' : 'outline'}>
        {granted ? t('permissions.granted') : t('permissions.notGranted')}
      </Badge>
      <Button
        variant="outline"
        type="button"
        className="permission-row-action"
        disabled={actionDisabled}
        onClick={onClick}
      >
        <SettingsIcon name={shown} className={shown === 'sync' ? 'spinning' : ''} style={{ width: 18, height: 18 }} />
        {actionLabel}
      </Button>
    </li>
  )
}
