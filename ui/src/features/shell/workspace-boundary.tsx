import { Component, type ReactNode } from 'react'
import { localizeMessage } from '@/format'
import { documentT } from '@/i18n'

// A render failure anywhere in the workspace shows why, instead of an empty window.
export class WorkspaceBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null }
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : documentT('app.initFailed') }
  }
  render() {
    if (this.state.error)
      return (
        <main className="mx-auto max-w-xl p-8">
          <h1 className="text-xl font-semibold">{documentT('app.unavailable')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{localizeMessage(this.state.error)}</p>
        </main>
      )
    return this.props.children
  }
}
