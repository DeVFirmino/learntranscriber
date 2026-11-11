import { useEffect, useRef } from 'react'
import { BrandAssistants, BrandHome, BrandSessions, BrandSettings } from '@/components/brand-icon'
import { NavigationMenu } from 'radix-ui'
import { Button } from '@/components/ui/button'
import type { MessageKey } from '@/i18n'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { HideButton } from './hide-button'
import { SETTINGS_SECTIONS, settingsSection } from './navigation'
import { NAV_PAGES } from './shell-pages'

const NAV_ITEMS = {
  home: ['nav.home', BrandHome],
  sessions: ['nav.sessions', BrandSessions],
  assistants: ['nav.assistants', BrandAssistants],
  settings: ['nav.settings', BrandSettings],
} as const satisfies Record<(typeof NAV_PAGES)[number], readonly [MessageKey, unknown]>

export function WorkspaceNav({ page, onPreview }: { page: string; onPreview: (open: boolean) => void }) {
  const ws = useWorkspace()
  const { t } = useT()
  const pointerInside = useRef(false)
  const subnav = useRef<HTMLDivElement>(null)
  const mainnav = useRef<HTMLDivElement>(null)
  const section = settingsSection(ws.route)
  useEffect(() => {
    const reveal = () => {
      if (window.innerWidth >= 960) return
      for (const nav of [mainnav.current, subnav.current]) {
        const active = nav?.querySelector<HTMLElement>('[data-current], [aria-current="page"]')
        if (!nav || !active) continue
        const item = active.getBoundingClientRect()
        const bounds = nav.getBoundingClientRect()
        if (item.right > bounds.right) nav.scrollLeft += item.right - bounds.right
        else if (item.left < bounds.left) nav.scrollLeft += item.left - bounds.left
      }
    }
    reveal()
    window.addEventListener('resize', reveal)
    return () => window.removeEventListener('resize', reveal)
  }, [section, page])
  const current = page === 'session' ? 'sessions' : page
  return (
    <nav
      id="workspace-navigation"
      aria-label={t('nav.workspace')}
      className="workspace-nav"
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') return
        pointerInside.current = true
        onPreview(true)
      }}
      onPointerLeave={(event) => {
        pointerInside.current = false
        if (!event.currentTarget.matches(':focus-within')) onPreview(false)
      }}
      onFocus={() => onPreview(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onPreview(pointerInside.current)
      }}
    >
      <NavigationMenu.Root asChild>
        <div ref={mainnav} className="workspace-nav-items">
          <NavigationMenu.List className="workspace-nav-list">
            {NAV_PAGES.map((id) => {
              const [label, Icon] = NAV_ITEMS[id]
              const selected = current === id
              return (
                <NavigationMenu.Item key={id}>
                  <NavigationMenu.Link asChild active={selected}>
                    <Button className="workspace-nav-link gap-2 font-normal" variant="ghost" asChild>
                      <a
                        href={`#${id}`}
                        title={t(label)}
                        aria-current={selected && id !== 'settings' ? 'page' : undefined}
                        aria-expanded={id === 'settings' ? selected : undefined}
                        data-current={selected || undefined}
                      >
                        <Icon aria-hidden="true" className="size-5" />
                        <span className="workspace-nav-label">{t(label)}</span>
                      </a>
                    </Button>
                  </NavigationMenu.Link>
                </NavigationMenu.Item>
              )
            })}
          </NavigationMenu.List>
        </div>
      </NavigationMenu.Root>
      {page === 'settings' ? (
        <div ref={subnav} className="workspace-subnav">
          {SETTINGS_SECTIONS.map(([id, label]) => (
            <a key={id} href={`#settings/${id}`} aria-current={section === id ? 'page' : undefined}>
              {t(label)}
            </a>
          ))}
        </div>
      ) : null}
      <div className="workspace-nav-footer">
        <HideButton />
      </div>
    </nav>
  )
}
