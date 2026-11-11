import { useState } from 'react'
import type { PublicState } from '@/bridge/types/state'
import { Card } from '@/components/ui/card'
import { useT } from '@/use-t'
import { CountUp } from './count-up'
import { sessionStats, sessionsPerDay } from './home-overview'

// In Home's side column: every session, the last seven days' and the assistants, above a bar for each of those days.
export function SessionStats({ state }: { state: PublicState }) {
  const { t } = useT()
  const [now] = useState(() => Date.now())
  const stats = sessionStats(state.sessions, now)
  const days = sessionsPerDay(state.sessions, now)
  const peak = Math.max(1, ...days.map((item) => item.count))
  const weekday = new Intl.DateTimeFormat(document.documentElement.lang || undefined, { weekday: 'narrow' })
  const numbers: [string, number, string][] = [
    [t('home.statSessions'), stats.total, stats.capped ? '+' : ''],
    [t('home.statWeek'), stats.thisWeek, ''],
    [t('home.statAssistants'), state.assistants.length, ''],
  ]
  return (
    <Card className="home-activity home-reveal">
      <dl className="home-activity-numbers">
        {numbers.map(([label, value, suffix]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <CountUp value={value} suffix={suffix} />
            </dd>
          </div>
        ))}
      </dl>
      <figure className="home-activity-chart">
        <figcaption>{t('home.activityChart')}</figcaption>
        <ol>
          {days.map((item, index) => (
            <li key={item.day} title={`${new Date(item.day).toLocaleDateString()} · ${item.count}`}>
              <span
                className="home-activity-bar"
                data-empty={item.count === 0 || undefined}
                style={{ '--bar': item.count / peak, '--reveal-index': index } as never}
              />
              <span aria-hidden="true">{weekday.format(item.day)}</span>
              <span className="sr-only">
                {new Date(item.day).toLocaleDateString()}: {item.count}
              </span>
            </li>
          ))}
        </ol>
      </figure>
    </Card>
  )
}
