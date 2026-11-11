import type { BuilderProposal } from '../../bridge/types/assistants'

export type ProposalStatus = 'pending' | 'applying' | 'done' | 'error'
export interface ProposalItem {
  id: number
  proposal: BuilderProposal
  status: ProposalStatus
  note: string
}
export interface Turn {
  role: 'user' | 'assistant'
  content: string
}

// A reply's proposals join the ones still waiting; the panel keeps the last eight.
export function queueProposals(current: ProposalItem[], proposals: BuilderProposal[], nextId: () => number) {
  return [
    ...current.filter((item) => item.status === 'pending'),
    ...proposals.map((proposal) => ({ id: nextId(), proposal, status: 'pending' as const, note: '' })),
  ].slice(-8)
}

export function withStatus(items: ProposalItem[], id: number, status: ProposalStatus, note?: string) {
  return items.map((item) => (item.id === id ? { ...item, status, ...(note === undefined ? {} : { note }) } : item))
}

// The conversation keeps the last four exchanges.
export function withExchange(turns: Turn[], question: string, answer: string) {
  return [
    ...turns,
    { role: 'user' as const, content: question },
    { role: 'assistant' as const, content: answer },
  ].slice(-8)
}

// The assistant a proposal acts on: the one it names, or the draft being built.
export function proposalTarget(proposal: BuilderProposal, draftName: string | undefined) {
  return String(proposal.args.assistant_name || proposal.args.assistant_id || draftName || '')
}

// Deleting needs the builder's own confirmation in the proposal before the user can apply it.
export function blockedProposal(proposal: BuilderProposal) {
  return proposal.tool === 'delete_assistant' && proposal.args.confirmed !== true
}
