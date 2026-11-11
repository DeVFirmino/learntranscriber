export function escapeBehavior({
  pinned,
  expanded,
  editing,
}: {
  pinned: boolean
  expanded: boolean
  editing: boolean
}) {
  if (pinned) return 'shortcuts'
  if (expanded) return 'panel'
  if (editing) return 'blur'
  return 'bar'
}
