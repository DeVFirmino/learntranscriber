import type { SVGProps } from 'react'
import { BrandAssistants } from '@/components/brand-icon'
import { PersonGlyph } from '@/components/person-glyph'
import { isBuiltIn } from '../assistant-catalog'
import { roleMark } from './assistant-glyphs'

// An assistant's icon: the app's person glyph, and for a built-in role or a custom avatar the person with its mark.
export function AssistantGlyph({
  id,
  className = '',
  ...props
}: { id: string } & Omit<SVGProps<SVGSVGElement>, 'ref'>) {
  const mark = roleMark(id, isBuiltIn({ id }))
  if (!mark) return <BrandAssistants aria-hidden="true" className={className} />
  return <PersonGlyph mark={mark} data-assistant-glyph={id} className={className} {...props} />
}
