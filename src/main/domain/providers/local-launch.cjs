const { contextSize } = require('./context-budget.cjs');

const BOUNDS = Object.freeze({
  localGpuLayers: [0, 99, 0],
  localBatchSize: [1, 4096, 256],
  localUbatchSize: [1, 4096, 64],
  localParallel: [1, 16, 1],
});
function launchPreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid local launch settings.');
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === 'localContextSize') result[key] = contextSize(value);
    else if (key === 'localWarmup') {
      if (typeof value !== 'boolean') throw new Error('Choose whether model warmup is enabled.');
      result[key] = value;
    } else if (Object.hasOwn(BOUNDS, key)) {
      const [min, max] = BOUNDS[key];
      if (!Number.isInteger(value) || value < min || value > max)
        throw new Error(`Invalid local runtime setting: ${key}.`);
      result[key] = value;
    } else throw new Error(`Unknown local launch setting: ${key}.`);
  }
  return result;
}
// cpuCount comes from the host; the server keeps one core free and uses at most eight threads.
function launchConfig(model, settings, cpuCount) {
  const values = Object.fromEntries(
    Object.entries(BOUNDS).map(([key, [min, max, fallback]]) => {
      const value = settings[key] ?? fallback;
      if (!Number.isInteger(value) || value < min || value > max)
        throw new Error(`Invalid local runtime setting: ${key}.`);
      return [key, value];
    }),
  );
  return {
    contextSize: contextSize(model.contextSize || settings.localContextSize),
    gpuLayers: values.localGpuLayers,
    batchSize: values.localBatchSize,
    ubatchSize: values.localUbatchSize,
    parallel: values.localParallel,
    warmup: settings.localWarmup === true,
    threads: Math.max(1, Math.min(cpuCount - 1, 8)),
  };
}
function tuningPlan(base, enabled = true) {
  if (!enabled) return [base];
  const noWarmup = { ...base, warmup: false };
  const lowGpu = { ...noWarmup, gpuLayers: Math.min(base.gpuLayers, 10) };
  const noGpu = { ...lowGpu, gpuLayers: 0 };
  const smallContextGpu = { ...lowGpu, contextSize: Math.min(base.contextSize, 4096) };
  const smallContext = { ...noGpu, contextSize: Math.min(base.contextSize, 4096) };
  const smallerContext = { ...smallContext, contextSize: Math.min(base.contextSize, 2048) };
  const boundedBatch = {
    ...smallerContext,
    batchSize: Math.min(base.batchSize, 512),
    ubatchSize: Math.min(base.ubatchSize, 128),
  };
  const seen = new Set();
  return [
    base,
    noWarmup,
    lowGpu,
    noGpu,
    ...(base.contextSize > 4096 ? [smallContextGpu] : []),
    smallContext,
    smallerContext,
    boundedBatch,
  ].filter((config) => {
    const key = JSON.stringify(config);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function launchArgs(config) {
  return [
    '-c',
    String(config.contextSize),
    '-t',
    String(config.threads),
    ...(config.gpuLayers > 0 ? ['--gpu-layers', String(config.gpuLayers)] : []),
    '--batch-size',
    String(config.batchSize),
    '--ubatch-size',
    String(config.ubatchSize),
    '--parallel',
    String(config.parallel),
    config.warmup ? '--warmup' : '--no-warmup',
  ];
}
function isAllocationFailure(message) {
  // Matches common out-of-memory phrasing and the allocator/KV-cache diagnostics below.
  return /(insufficient memory|outofmemory|out of memory|not enough memory|cannot allocate memory|failed to allocate|allocation failed|kv cache.{0,40}alloc)/i.test(
    message,
  );
}
module.exports = { BOUNDS, launchConfig, launchPreferences, tuningPlan, launchArgs, isAllocationFailure };
