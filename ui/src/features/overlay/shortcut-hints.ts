import type { ShortcutDefinition } from '../../bridge/types/settings'

export type HintId = 'record' | 'capture' | 'ask' | 'mic' | 'hide' | 'overlay' | 'previousResponse' | 'nextResponse'

export interface Hint {
  id: HintId
  accelerator: string
}

export interface HintGroups {
  now: Hint[]
  windows: Hint[]
  answers: Hint[]
}

// The sheet's rows for the floating assistant's current state: what to do now, how to hide or bring windows back,
// and, once there are answers, how to move between them. Only enabled shortcuts with a key are listed.
export function shortcutHints(
  definitions: Pick<ShortcutDefinition, 'id' | 'accelerator' | 'enabled'>[],
  context: { listening: boolean; answers: boolean },
): HintGroups {
  const pick = (ids: HintId[]) =>
    ids.flatMap((id) => {
      const definition = definitions.find((item) => item.id === id)
      return definition?.enabled && definition.accelerator ? [{ id, accelerator: definition.accelerator }] : []
    })
  return {
    now: pick(context.listening ? ['record', 'capture', 'mic'] : ['record', 'capture', 'ask']),
    windows: pick(['hide', 'overlay']),
    answers: context.answers ? pick(['previousResponse', 'nextResponse']) : [],
  }
}
