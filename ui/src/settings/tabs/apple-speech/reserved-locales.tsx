import { SettingsIcon } from '../../settings-icon'
import { useSettingsT } from '../../use-settings-t'
import { sameLocale, type describeLocale } from './speech-locales'

// The languages this app reserved on the Mac, how many of the allowed ones are used, and releasing one.
export function ReservedLocales({
  reserved,
  maximum,
  releasing,
  onRelease,
}: {
  reserved: ReturnType<typeof describeLocale>[]
  maximum: number
  releasing: string
  onRelease: (locale: string) => void
}) {
  const { st } = useSettingsT()
  return (
    <div className="apple-speech-reservations">
      {maximum > 0 ? (
        <div className="apple-speech-reservation-summary">
          {st('settings.api.localModels.appleSpeechReservationUsage', { count: reserved.length, maximum })}
        </div>
      ) : null}
      {reserved.length ? (
        <div className="apple-speech-ready-chip-list">
          {reserved.map((item) => (
            <div className="apple-speech-ready-chip" key={item.identifier}>
              <span className="apple-speech-ready-chip-flag" aria-hidden="true">
                {item.flag}
              </span>
              <span className="apple-speech-ready-chip-name">{item.displayName}</span>
              <button
                type="button"
                className="apple-speech-release-button"
                onClick={() => onRelease(item.identifier)}
                disabled={Boolean(releasing)}
                aria-label={st('settings.api.localModels.appleSpeechLocaleReleaseAria', {
                  locale: item.displayName,
                })}
              >
                <SettingsIcon name="close" />
                <span>
                  {releasing && sameLocale(releasing, item.identifier)
                    ? st('settings.api.localModels.appleSpeechLocaleReleasing')
                    : st('settings.api.localModels.appleSpeechLocaleReleaseAction')}
                </span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="apple-speech-locale-empty">
          <SettingsIcon name="info" />
          <span>{st('settings.api.localModels.appleSpeechLocalesNoneReserved')}</span>
        </div>
      )}
    </div>
  )
}
