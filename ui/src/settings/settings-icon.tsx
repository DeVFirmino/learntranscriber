import type { SVGProps } from 'react'
import {
  DARK_SURFACE_LOGOS,
  isThirdPartyLogo,
  THIRD_PARTY_LOGOS,
  type ThirdPartyLogoName,
} from './icons/third-party-logos'
import { BRAND_ICONS } from './icons/brand-glyphs'
import { ICON_STROKE, ICONS, type SettingsIconName } from './icons/glyphs'

const isSettingsIcon = (name: string): name is SettingsIconName => Object.hasOwn(ICONS, name) || isThirdPartyLogo(name)

// A settings glyph sized by the surrounding font size (1em); the
// `settings-icon` class carries its icon styling hooks.
const logoTone = (name: ThirdPartyLogoName) => {
  const mode = DARK_SURFACE_LOGOS[name]
  return mode ? `logo-${mode}` : ''
}

export function SettingsIcon({
  name,
  className = '',
  ...props
}: { name: SettingsIconName } & Omit<SVGProps<SVGSVGElement>, 'name' | 'ref'>) {
  if (isThirdPartyLogo(name)) {
    return (
      <svg
        aria-hidden="true"
        focusable="false"
        width="1em"
        height="1em"
        className={`settings-icon third-party-logo ${logoTone(name)} ${className}`.trim()}
        {...props}
      >
        <image
          href={`${import.meta.env.BASE_URL}brands/${THIRD_PARTY_LOGOS[name]}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        />
      </svg>
    )
  }
  const Icon = BRAND_ICONS[name] || ICONS[name]
  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      size="1em"
      strokeWidth={ICON_STROKE}
      className={`settings-icon ${className}`.trim()}
      {...props}
    />
  )
}

// Local models and custom endpoints retain category icons; named providers use original logos.
export function ProviderIcon({ providerId }: { providerId: string }) {
  const name = `provider-${providerId}`
  return isSettingsIcon(name) ? <SettingsIcon name={name} /> : null
}
