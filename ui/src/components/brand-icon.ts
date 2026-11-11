import { createElement, forwardRef } from 'react'
import type { LucideIcon, LucideProps } from 'lucide-react'
import { BrandGlyph, type BrandIconName } from './brand-glyph'

export type { BrandIconName }

// Each glyph as its own icon component, so it fits wherever a Lucide icon goes.
function createBrandIcon(name: BrandIconName): LucideIcon {
  const Icon = forwardRef<SVGSVGElement, LucideProps>((props, ref) =>
    createElement(BrandGlyph, { ...props, name, ref }),
  )
  Icon.displayName = `Brand${name[0].toUpperCase()}${name.slice(1)}`
  return Icon
}

export const BrandHome = createBrandIcon('home')
export const BrandSessions = createBrandIcon('sessions')
export const BrandAssistants = createBrandIcon('assistants')
export const BrandAudio = createBrandIcon('audio')
export const BrandModels = createBrandIcon('models')
export const BrandConnections = createBrandIcon('connections')
export const BrandPrivacy = createBrandIcon('privacy')
export const BrandShortcuts = createBrandIcon('shortcuts')
export const BrandCapture = createBrandIcon('capture')
export const BrandMemory = createBrandIcon('memory')
export const BrandTranscript = createBrandIcon('transcript')
export const BrandSettings = createBrandIcon('settings')
export const BrandTimer = createBrandIcon('timer')
export const BrandScroll = createBrandIcon('scroll')
export const BrandSelection = createBrandIcon('selection')
export const BrandCompact = createBrandIcon('compact')
export const BrandKey = createBrandIcon('key')
export const BrandCloud = createBrandIcon('cloud')
export const BrandTerminal = createBrandIcon('terminal')
export const BrandVault = createBrandIcon('vault')
export const BrandCalendar = createBrandIcon('calendar')
export const BrandSheets = createBrandIcon('sheets')
export const BrandVision = createBrandIcon('vision')
export const BrandStealth = createBrandIcon('stealth')
export const BrandScreen = createBrandIcon('screen')
export const BrandListen = createBrandIcon('listen')
export const BrandNotch = createBrandIcon('notch')
