import { ActionButton } from '@/components/ui/action-button'
import { ChevronDown, MessageSquareText, PanelTop } from 'lucide-react'
import { BrandCapture } from '@/components/brand-icon'
import { DropdownMenu } from 'radix-ui'
import { toast } from 'sonner'
import type { PublicState } from '@/bridge/types/state'
import { Button } from '@/components/ui/button'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { AssistantMenu } from './assistant-menu'
import { HomeLoop } from './home-loop'
import { LiveClock, LiveControls } from './live-session'
import { liveSession } from './live-session-state'
import { createStartActions } from './start-actions'
import './start-hero.css'

const MENU_ITEM = 'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 outline-none focus:bg-accent'

// Home's lead card. Before a recording it starts one with the chosen assistant; while one runs it becomes that
// recording, with its title, clock and controls, and the other actions stay in the menu.
export function StartHero({ state }: { state: PublicState }) {
  const ws = useWorkspace()
  const { t } = useT()
  const live = liveSession(state)
  const status = live?.paused ? t('home.livePaused') : t('home.live')
  // Without a known session the state itself is the title, so the status line keeps only the dot and the clock.
  const title = live ? live.session?.title || status : t('home.startTitle')
  const actions = createStartActions({
    ensureSession: ws.ensureSession,
    startFloatingSession: ws.startFloatingSession,
    recording: () => ws.audio.recording,
    toggleListening: ws.toggleListening,
    captureScreen: ws.captureScreen,
    quickScreenshot: () => state.settings.quickScreenshot,
    attached: () => toast.message(t('home.captured')),
    focusQuestion: () => document.querySelector<HTMLTextAreaElement>('#chat-input')?.focus(),
  })
  return (
    <section
      className="home-start-hero relative isolate -mx-2 mb-6 rounded-2xl"
      aria-label={live ? t('home.live') : t('home.startTitle')}
      data-live={live ? (live.paused ? 'paused' : 'recording') : undefined}
    >
      <HomeLoop />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {live ? (
            <p className="home-live-status">
              <span className="home-live-dot" aria-hidden="true" />
              {title === status ? null : status}
              <LiveClock since={live.since} />
            </p>
          ) : null}
          <h1
            tabIndex={-1}
            className="home-start-title w-fit rounded-md leading-tight font-semibold tracking-[-0.025em]"
          >
            {title}
          </h1>
          {live ? null : <AssistantMenu state={state} />}
        </div>
        <div className="home-start-controls">
          {live ? (
            <LiveControls live={live} />
          ) : (
            <ActionButton onClick={() => void ws.act(actions.start)}>{t('home.startListening')}</ActionButton>
          )}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" className="home-start-more gap-2">
                {t('home.moreActions')}
                <ChevronDown aria-hidden="true" className="size-3.5" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                collisionPadding={12}
                avoidCollisions
                style={{
                  maxWidth: 'calc(100vw - 24px)',
                  maxHeight: 'var(--radix-dropdown-menu-content-available-height)',
                  overflowY: 'auto',
                }}
                className="home-start-menu z-50 grid min-w-56 gap-1 rounded-xl border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
              >
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => void ws.act(actions.capture)}>
                  <BrandCapture aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  {t('home.capture')}
                </DropdownMenu.Item>
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => void ws.act(actions.ask)}>
                  <MessageSquareText aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  {t('home.ask')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={MENU_ITEM}
                  onSelect={() => void ws.act(() => ws.api.toggleOverlay().then(() => undefined))}
                >
                  <PanelTop aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  {t('home.floating')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </section>
  )
}
