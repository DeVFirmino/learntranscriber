import type { BuilderProposal } from '@/bridge/types/assistants'
import { Button } from '@/components/ui/button'
import { useT } from '@/use-t'
import { blockedProposal, proposalTarget, type ProposalItem } from './builder-proposals'

// What the builder proposes to change in the library, each applied or dismissed by the user; a failed one can be
// tried again.
export function BuilderProposalList({
  proposals,
  draftName,
  busy,
  onApply,
  onDismiss,
}: {
  proposals: ProposalItem[]
  draftName: string | undefined
  busy: boolean
  onApply: (id: number) => void
  onDismiss: (id: number) => void
}) {
  const { t } = useT()
  const describe = (proposal: BuilderProposal) =>
    t(`builder.action.${proposal.tool}`, {
      name:
        proposal.tool === 'create_assistant'
          ? String(proposal.args.assistant_name || '')
          : proposalTarget(proposal, draftName),
      category: String(proposal.args.category || ''),
    })
  const actions = (item: ProposalItem) => {
    if (item.status === 'applying')
      return (
        <p role="status" className="text-xs text-muted-foreground">
          {t('builder.applying')}
        </p>
      )
    if (item.status === 'done') return null
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={item.proposal.tool === 'delete_assistant' ? 'destructive' : 'default'}
          disabled={blockedProposal(item.proposal) || busy}
          onClick={() => onApply(item.id)}
        >
          {item.status === 'error' ? t('builder.retry') : t('builder.apply')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onDismiss(item.id)}>
          {t('builder.dismiss')}
        </Button>
      </div>
    )
  }
  return (
    <div className="grid gap-2" aria-label={t('builder.proposals')}>
      <p className="text-xs font-medium text-muted-foreground">{t('builder.proposals')}</p>
      {proposals.map((item) => (
        <div key={item.id} className="grid gap-2 rounded-lg border p-3">
          <p className="text-sm">{describe(item.proposal)}</p>
          {blockedProposal(item.proposal) ? (
            <p className="text-xs text-muted-foreground">{t('builder.unconfirmed')}</p>
          ) : null}
          {item.note ? (
            <p
              role={item.status === 'error' ? 'alert' : 'status'}
              className={`text-xs ${item.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {item.note}
            </p>
          ) : null}
          {actions(item)}
        </div>
      ))}
    </div>
  )
}
