// Mono PCM16 helpers for streaming transcription.

// Linear resampling of 16 kHz samples to the 24 kHz the realtime transcription API expects.
function resample16kTo24k(input) {
  const output = new Int16Array(Math.floor((input.length * 3) / 2));
  for (let i = 0; i < output.length; i++) {
    const position = (i * 2) / 3,
      index = Math.floor(position),
      fraction = position - index;
    const a = input[index] ?? 0,
      b = input[Math.min(index + 1, input.length - 1)] ?? a;
    output[i] = Math.round(a + (b - a) * fraction);
  }
  return output;
}

// Root-mean-square level of a block of samples; speech in these meetings sits well above 500.
function level(samples) {
  let energy = 0;
  for (const value of samples) energy += value * value;
  return samples.length ? Math.sqrt(energy / samples.length) : 0;
}

module.exports = { resample16kTo24k, level };
