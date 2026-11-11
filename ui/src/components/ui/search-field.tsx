import { useRef } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from './input'
import { Button } from './button'
import './search-field.css'

export function SearchField({
  value,
  label,
  clearLabel,
  onValueChange,
}: {
  value: string
  label: string
  clearLabel: string
  onValueChange: (value: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="search-field" role="group" aria-label={label}>
      <Input
        ref={input}
        type="search"
        value={value}
        aria-label={label}
        placeholder={label}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <Search aria-hidden="true" className="search-field-icon" />
      {value ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={clearLabel}
          onClick={() => {
            onValueChange('')
            input.current?.focus()
          }}
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  )
}
