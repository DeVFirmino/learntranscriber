import { useEffect } from 'react'
import { ThemeProvider } from 'next-themes'
import { CaptureNotice } from '@/components/capture-notice'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Shell } from '@/features/shell/shell'
import { WorkspaceZoom } from '@/features/shell/workspace-zoom'
import { WorkspaceBoundary } from '@/features/shell/workspace-boundary'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { WorkspaceProvider } from '@/workspace-provider'

// All windows follow the same persisted appearance preference.
function Themed() {
  const ws = useWorkspace()
  const floating = ws.overlay || ws.windowRole === 'notch'
  const { language } = useT()
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  return (
    <ThemeProvider
      attribute="class"
      forcedTheme={ws.state?.settings.surfaceTheme === 'light' ? 'light' : 'dark'}
      enableSystem={false}
      disableTransitionOnChange
    >
      <TooltipProvider>
        {!floating ? <WorkspaceZoom /> : null}
        <Shell />
        {!floating ? <CaptureNotice /> : null}
        <Toaster position={floating ? 'top-center' : 'bottom-right'} />
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default function App() {
  return (
    <WorkspaceBoundary>
      <WorkspaceProvider>
        <Themed />
      </WorkspaceProvider>
    </WorkspaceBoundary>
  )
}
