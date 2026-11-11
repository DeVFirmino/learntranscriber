import { Switch } from '@/components/ui/switch'

// A settings on/off control: the app's shared switch, so every settings page uses the same blue checked state.
export function Toggle({
  checked,
  onChange,
  disabled = false,
  className = '',
  ariaLabel,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  ariaLabel?: string
}) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={(value) => onChange(value === true)}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
    />
  )
}
