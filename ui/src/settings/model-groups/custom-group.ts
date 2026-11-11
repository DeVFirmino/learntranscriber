import { customServer, type Card, type Group, type ProviderSetup } from './cards'

// The custom endpoint group: Ollama, LM Studio or any OpenAI-compatible server, with the models it reported or the
// saved model while it reports none.
export function customGroup(
  setup: ProviderSetup,
  purpose: 'analysis' | 'translation',
  pick: Group['choose'],
  is: Group['selected'],
): Group {
  const { st, settings } = setup
  const translation = purpose === 'translation'
  const server = customServer(settings.customBaseUrl || '')
  const name = server.name || (translation ? st('settings.models.customApiLabel', 'Custom API') : 'Custom API')
  const listed = setup.available.custom || []
  const fallbackName = server.name || st('settings.models.customApiLabel', 'Custom API')
  const models: Card[] = listed.length
    ? listed.map((id) => ({
        id,
        name: id,
        description: st('settings.models.customServerModelDesc', { server: fallbackName }),
        icon: server.icon,
      }))
    : [
        {
          id: settings.model || 'custom',
          name: fallbackName,
          description: settings.model || st('settings.models.customApiEndpointDesc', 'OpenAI-compatible API endpoint'),
          icon: server.icon,
        },
      ]
  let description = 'OpenAI-compatible endpoint configured in the API tab.'
  if (translation)
    description = st('settings.models.translationCustomDesc', 'Translate via your configured custom endpoint.')
  else if (server.local) description = `Models available on your ${name} server.`
  return {
    id: `custom-${purpose}`,
    title: name,
    description,
    badge: server.local
      ? st('settings.models.badge.localServer', 'Local Server')
      : st('settings.models.badge.custom', 'Custom'),
    icon: server.icon,
    models,
    choose: pick,
    selected: is,
  }
}
