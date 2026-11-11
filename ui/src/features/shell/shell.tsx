import { useEffect, useRef, useState } from 'react'
import { WorkspaceDialogs } from '@/features/dialogs/workspace-dialogs'
import { focusNewPage } from '@/features/page-focus'
import { Assistants } from '@/pages/assistants'
import { Home } from '@/pages/home'
import { Notch } from '@/pages/notch'
import { Overlay } from '@/pages/overlay'
import { Session } from '@/pages/session'
import { Sessions } from '@/pages/sessions'
import { SettingsPage } from '@/settings/settings-page'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { ShellBanners } from './shell-banners'
import { pageFor } from './shell-pages'
import { canonicalRoute } from './navigation'
import { WorkspaceHeader } from './workspace-header'
import { WorkspaceNav } from './workspace-nav'
import './workspace-layout.css'
import './workspace-surfaces.css'
import './workspace-navigation.css'
import './workspace-rail.css'

// What this window shows: the Notch, the floating overlay, or the workspace with its header, navigation and page. A
// new page takes the focus.
export function Shell() {
  const [navCollapsed, setNavCollapsed] = useState(true)
  const [navPreview, setNavPreview] = useState(false)
  const collapsed = navCollapsed && !navPreview
  const ws = useWorkspace()
  const { t } = useT()
  const page = pageFor(ws.route)
  const location = canonicalRoute(ws.route)
  const shownPage = useRef(location)
  useEffect(() => {
    if (shownPage.current === location) return
    shownPage.current = location
    const main = document.getElementById('workspace-content')
    main?.scrollTo({ top: 0, left: 0 })
    focusNewPage(main, document.activeElement)
  }, [location])
  if (ws.windowRole === 'notch') return <Notch key={ws.state?.activeSessionId || 'none'} />
  if (ws.overlay) return <Overlay />
  if (ws.loadError) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-xl font-semibold">{t('app.unavailable')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{ws.loadError}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t('app.bridgeError')}</p>
      </main>
    )
  }
  if (!ws.state) return <main className="p-8 text-sm text-muted-foreground">{t('app.loading')}</main>
  void ws.audioRev
  return (
    <div className="workspace-shell bg-background text-foreground">
      <ShellBanners />
      <div className="workspace-frame" data-page={page} data-nav-collapsed={collapsed}>
        <a
          href="#workspace-content"
          className="sr-only fixed left-4 top-3 z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only"
          onClick={(event) => {
            event.preventDefault()
            document.getElementById('workspace-content')?.focus()
          }}
        >
          {t('nav.skip')}
        </a>
        <WorkspaceHeader
          collapsed={collapsed}
          onToggle={() => {
            setNavCollapsed(!collapsed)
            setNavPreview(false)
          }}
        />
        <WorkspaceNav page={page} onPreview={setNavPreview} />
        <main id="workspace-content" tabIndex={-1} className="workspace-content min-w-0 outline-none" data-page={page}>
          {page === 'home' ? <Home /> : null}
          {page === 'sessions' ? <Sessions /> : null}
          {page === 'session' ? <Session /> : null}
          {page === 'assistants' ? <Assistants /> : null}
          {page === 'settings' ? <SettingsPage /> : null}
        </main>
      </div>
      <WorkspaceDialogs />
    </div>
  )
}
