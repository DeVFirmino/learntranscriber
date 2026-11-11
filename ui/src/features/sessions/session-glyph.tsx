import type { SVGProps } from 'react'
import { PersonGlyph } from '@/components/person-glyph'
import { randomMark } from '@/features/assistants/assistant-glyphs'

// A session's icon: the person with a mark picked at random from the session's own id, so sessions with the same
// assistant don't all look alike, and each keeps its mark.
export function SessionGlyph({ id, ...props }: { id: string } & Omit<SVGProps<SVGSVGElement>, 'ref'>) {
  return <PersonGlyph mark={randomMark(id)} data-session-glyph={id} {...props} />
}
