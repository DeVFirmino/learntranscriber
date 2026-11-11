export function questionPresentation({
  asking,
  expanded,
  answerArrived,
}: {
  asking: boolean
  expanded: boolean
  answerArrived: boolean
}): boolean {
  return asking && expanded && !answerArrived
}
