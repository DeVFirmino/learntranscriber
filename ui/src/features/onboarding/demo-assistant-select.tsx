import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useT } from '@/use-t'
import { DEMO_ASSISTANTS, type DemoAssistant } from './demo-assistants'

export function DemoAssistantSelect({
  value,
  disabled,
  onChange,
}: {
  value: DemoAssistant
  disabled: boolean
  onChange: (value: string) => void
}) {
  const { t } = useT()
  return (
    <div className="onboarding-demo-assistant">
      <label htmlFor="onboarding-demo-assistant">{t('onboardingDemo.assistant')}</label>
      <Select value={value} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger id="onboarding-demo-assistant">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {DEMO_ASSISTANTS.map((id) => (
            <SelectItem key={id} value={id}>
              {t(`onboardingDemo.${id}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
