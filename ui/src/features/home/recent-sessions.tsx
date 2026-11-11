import type { PublicState } from '@/bridge/types/state'
import { Empty } from '@/components/chrome'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { SessionGlyph } from '@/features/sessions/session-glyph'
import { formatDate } from '@/format'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { liveSession } from './live-session-state'

// The six latest sessions as compact rows: each one's own icon, its title, its state and summary, then when.
export function RecentSessions({ state }: { state: PublicState }) {
  const ws = useWorkspace()
  const { t } = useT()
  // The session a running recording writes to reads as recording rather than saved.
  const recording = liveSession(state)?.session?.id
  return (
    <Card className="home-reveal">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('home.recent')}</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <a href="#sessions">{t('home.viewAll')}</a>
        </Button>
      </CardHeader>
      <CardContent>
        {state.sessions.length ? (
          <ul className="home-recent-list" role="list">
            {state.sessions.slice(0, 6).map((session) => (
              <li key={session.id}>
                <Item asChild className="home-recent-row">
                  <button type="button" onClick={() => void ws.act(() => ws.openSession(session.id))}>
                    <ItemMedia className="home-tile">
                      <SessionGlyph id={session.id} className="size-6 text-foreground" />
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="w-full">
                        <span className="truncate">{session.title}</span>
                        {session.id === recording ? (
                          <Badge className="shrink-0">{t('home.live')}</Badge>
                        ) : (
                          <Badge variant="outline" className="shrink-0">
                            {session.ended_at ? t('sessions.ended') : t('sessions.saved')}
                          </Badge>
                        )}
                      </ItemTitle>
                      <ItemDescription className="line-clamp-1">
                        {session.summary.slice(0, 170) || t('sessions.openHint')}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="home-recent-when">{formatDate(session.started_at)}</ItemActions>
                  </button>
                </Item>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{t('sessions.empty')}</Empty>
        )}
      </CardContent>
    </Card>
  )
}
