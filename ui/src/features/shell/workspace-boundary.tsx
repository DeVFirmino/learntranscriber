import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportUnhandled } from '@/bridge'
import { Button } from '@/components/ui/button'
import { localizeMessage } from '@/format'
import { documentT } from '@/i18n'

// Read by shape rather than instanceof, so an error thrown from another realm still keeps its message.
const messageOf = (error: unknown) =>
  typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : null

// A render failure anywhere in the workspace shows why and a way back, instead of an empty window, and goes to the
// error log. The card carries its own background because the floating windows are transparent.
export class WorkspaceBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null }
  static getDerivedStateFromError(error: unknown) {
    return { error: messageOf(error) ?? documentT('app.initFailed') }
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    const where = info.componentStack?.trim().split('\n')[0]?.trim()
    reportUnhandled(`Window render failed: ${messageOf(error) ?? String(error)}${where ? ` (${where})` : ''}`)
  }
  render() {
    if (this.state.error)
      return (
        <main className="grid min-h-svh place-items-center p-3">
          <div className="max-w-md rounded-xl border bg-background p-5 text-foreground shadow-lg">
            <h1 className="text-base font-semibold">{documentT('app.unavailable')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{localizeMessage(this.state.error)}</p>
            <Button className="mt-4" size="sm" onClick={() => window.location.reload()}>
              {documentT('app.reloadWindow')}
            </Button>
          </div>
        </main>
      )
    return this.props.children
  }
}
