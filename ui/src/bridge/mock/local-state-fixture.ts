import type { LocalState } from '../types/local-models'

// The local models feature's starting point: no downloads yet, both runtimes stopped.
export const emptyLocal = (): LocalState => ({
  models: [],
  binaries: {},
  operations: [],
  runtimes: {
    llm: { status: 'stopped', modelId: null, error: '' },
    whisper: { status: 'stopped', modelId: null, error: '' },
  },
})
