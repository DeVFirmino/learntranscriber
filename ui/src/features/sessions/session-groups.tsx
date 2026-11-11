import { useState } from 'react'
import { DateHeading } from '@/components/ui/date-heading'
import type { SessionSummary } from '@/bridge/types/sessions'
import { useT } from '@/use-t'
import { SessionRow } from './session-row'
import './session-list.css'
import { groupByDay, sessionDate, type DayGroup } from './session-display'

// The page's sessions under one heading per day (today, yesterday, then the date), each day one list of rows.
export function SessionGroups({
  rows,
  selecting,
  selected,
  onToggle,
}: {
  rows: SessionSummary[]
  selecting: boolean
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  const { t, language } = useT()
  // Today and Yesterday are fixed when the list mounts.
  const [today] = useState(() => new Date())
  const label = (group: DayGroup<SessionSummary>) => {
    if (group.day === 'today') return t('sessions.today')
    if (group.day === 'yesterday') return t('sessions.yesterday')
    return sessionDate(group.date, language)
  }
  return (
    <div className="grid gap-6">
      {groupByDay(rows, today).map((group) => (
        <section key={group.date} className="grid gap-3" aria-label={label(group)}>
          <DateHeading label={label(group)} date={group.date} />
          <div className="session-day-list">
            {group.sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                selecting={selecting}
                selected={selected.has(session.id)}
                onToggle={() => onToggle(session.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
