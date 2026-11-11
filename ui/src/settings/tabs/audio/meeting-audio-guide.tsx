import { ChevronDown } from 'lucide-react'
import { useT } from '@/use-t'
import { useSettingsT } from '../../use-settings-t'

export function MeetingAudioGuide() {
  const { t } = useT()
  const { st } = useSettingsT()
  return (
    <details className="meeting-audio-guide">
      <summary>
        <span>{st('settings.audio.meetingGuide.button')}</span>
        <ChevronDown aria-hidden="true" className="size-4" />
      </summary>
      <ol>
        <li>{t('audioGuide.source')}</li>
        <li>
          {t('audioGuide.permissions')} <a href="#settings/permissions">{t('nav.permissions')}</a>
        </li>
        <li>
          {t('audioGuide.transcription')} <a href="#settings/ai">{t('nav.ai')}</a>
        </li>
        <li>{t('audioGuide.start')}</li>
      </ol>
    </details>
  )
}
