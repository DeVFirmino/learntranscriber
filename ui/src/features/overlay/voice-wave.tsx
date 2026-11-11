import { useEffect, useState } from 'react'
import type { AudioLevels } from '@/bridge/types/audio'
import { VoiceMark } from '@/components/voice-mark'
import { useWorkspace } from '@/workspace'

// Each bar's share of the level, so one level still draws a wave rather than a block.
const SHAPE = [0.55, 1, 0.75, 0.4]

// The bar's live wave while recording: four brand-blue bars that follow the louder side, the workspace reporting
// each side's loudness. Paused or silent, the bars rest low; reduced motion turns off their easing.
export function VoiceWave({ paused }: { paused: boolean }) {
  const ws = useWorkspace()
  const [levels, setLevels] = useState<AudioLevels>({ me: 0, they: 0 })
  useEffect(() => ws.api.onAudioLevels(setLevels), [ws.api])
  const level = paused ? 0 : Math.max(levels.me, levels.they)
  return <VoiceMark data-voice-wave heights={SHAPE.map((shape) => Math.round((0.2 + 0.8 * level * shape) * 20))} />
}
