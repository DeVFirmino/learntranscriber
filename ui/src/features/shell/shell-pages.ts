import { canonicalRoute } from './navigation'

export const NAV_PAGES = ['home', 'sessions', 'assistants', 'settings'] as const

export function pageFor(route: string) {
  const location = canonicalRoute(route)
  if (location === 'session') return 'session'
  if ((NAV_PAGES as readonly string[]).includes(location)) return location
  const page = location.split('/')[0]
  return page === 'settings' || page === 'assistants' ? page : 'home'
}
