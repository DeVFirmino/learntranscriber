import { Switch } from '@/components/ui/switch'
import { SettingRow } from '@/components/chrome'
import type { Settings } from '@/bridge/types/settings'
import { useWorkspace } from '@/workspace'

// A settings row backed by one boolean setting, with an optional override for a value another setting implies.
export function Toggle({
  name,
  title,
  description,
  disabled = false,
  effective,
}: {
  name: keyof Settings
  title: string
  description: string
  disabled?: boolean
  effective?: boolean
}) {
  const ws = useWorkspace()
  const checked = effective ?? Boolean(ws.state?.settings[name])
  return (
    <SettingRow title={title} description={description}>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) =>
          void ws.act(async () => {
            await ws.api.settings({ [name]: value === true })
          })
        }
        aria-label={title}
      />
    </SettingRow>
  )
}
