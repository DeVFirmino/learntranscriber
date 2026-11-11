import type { KeyboardEvent } from 'react'

// Stands for a stored key: the encrypted key never returns to the window.
export const MASK = '••••••••••••••••••••••••••••••••'

// Enter saves a typed value the way leaving the field does.
export const blurOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key !== 'Enter') return
  event.preventDefault()
  event.currentTarget.blur()
}
