// Stands in for the latency a real IPC round-trip, download or model call would have.
export function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
