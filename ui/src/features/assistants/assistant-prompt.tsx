import { useState } from 'react'
import { Collapsible } from 'radix-ui'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/use-t'
import { promptPreview } from './prompt-preview'

export function AssistantPrompt({ name, prompt }: { name: string; prompt: string }) {
  const [expanded, setExpanded] = useState(false)
  const { t } = useT()
  return (
    <Collapsible.Root open={expanded} onOpenChange={setExpanded} className="assistant-instructions">
      <p className="assistant-prompt-preview" hidden={expanded}>
        {promptPreview(prompt)}
      </p>
      <Collapsible.Content className="assistant-prompt-content">
        <p tabIndex={0} aria-label={name}>
          {prompt}
        </p>
      </Collapsible.Content>
      <Collapsible.Trigger asChild>
        <Button type="button" size="sm" variant="ghost" className="assistant-prompt-toggle">
          {t(expanded ? 'assistants.hideInstructions' : 'assistants.showInstructions')}
          <ChevronDown aria-hidden="true" />
        </Button>
      </Collapsible.Trigger>
    </Collapsible.Root>
  )
}
