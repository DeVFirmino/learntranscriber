export const SETTINGS_SECTIONS = [
  ['general', 'nav.general'],
  ['ai', 'nav.ai'],
  ['features', 'nav.behavior'],
  ['privacy', 'nav.privacy'],
  ['permissions', 'nav.permissions'],
  ['data', 'nav.data'],
] as const
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number][0]

// Existing links from dialogs, saved locations and native entry points resolve to one destination.
export function canonicalRoute(route: string) {
  const [page, section = '', ...detail] = route.split('/')
  if (page === 'privacy') return 'settings/privacy'
  if (page !== 'settings') return route
  if (section === 'api') return ['settings', 'ai', 'sources', ...detail].join('/')
  if (section === 'shortcuts') return 'settings/features/shortcuts'
  if (section === 'models') return 'settings/ai/models'
  const tab = SETTINGS_SECTIONS.find(([id]) => id === section)?.[0] || 'general'
  return ['settings', tab, ...detail].join('/')
}

export function settingsSection(route: string): SettingsSection {
  const section = canonicalRoute(route).split('/')[1]
  return SETTINGS_SECTIONS.find(([id]) => id === section)?.[0] || 'general'
}

export function aiLocation(route: string) {
  const [, , view, provider] = canonicalRoute(route).split('/')
  return { view: view === 'models' ? ('models' as const) : ('sources' as const), provider: provider || null }
}
