/// Turns Float32 frames at the device rate into mono at the helper rate, the format every capture path delivers.
/// Channels are averaged and samples linearly interpolated; the phase carries across calls, so splitting the same
/// audio into different buffers gives the same output.
public struct MonoResampler: Sendable {
    /// The device rate the input arrives at; a rate that is not positive is taken as the helper rate.
    public let sourceRate: Double
    private let step: Double
    /// Position of the next output sample, in source samples, counted from the last sample of the previous call.
    private var position = 1.0
    private var last: Float = 0

    /// Creates a resampler for input at `sourceRate` frames per second.
    public init(sourceRate: Double) {
        let targetRate = Double(HelperAudioFormat.sampleRate)
        self.sourceRate = sourceRate > 0 ? sourceRate : targetRate
        step = self.sourceRate / targetRate
    }

    /// Averages each frame of `samples`, which interleave `channels` channels, and returns the mono samples at the
    /// helper rate. A trailing partial frame is ignored.
    public mutating func resample(interleaved samples: UnsafeBufferPointer<Float>, channels: Int) -> [Float] {
        let channels = max(1, channels)
        let frames = samples.count / channels
        guard frames > 0 else { return [] }
        var mono = [Float](repeating: 0, count: frames + 1)
        mono[0] = last
        for frame in 0..<frames {
            var sum: Float = 0
            for channel in 0..<channels { sum += samples[frame * channels + channel] }
            mono[frame + 1] = sum / Float(channels)
        }
        var output: [Float] = []
        output.reserveCapacity(Int(Double(frames) / step) + 1)
        while position <= Double(frames) {
            let index = Int(position), fraction = Float(position - Double(index))
            let next = index + 1 < mono.count ? mono[index + 1] : mono[index]
            output.append(mono[index] + (next - mono[index]) * fraction)
            position += step
        }
        position -= Double(frames)
        last = mono[frames]
        return output
    }

    /// Mixes the buffers of one audio buffer list and returns the mono samples at the helper rate.
    ///
    /// Empty buffers and buffers without channels are skipped. A single buffer is resampled as interleaved audio.
    /// Several buffers are planar: the first channel of each is averaged, frame by frame, over the frames every
    /// buffer has, and the mix is resampled.
    public mutating func resample(planar buffers: [SampleBuffer]) -> [Float] {
        let usable = buffers.filter { $0.samples.isEmpty == false && $0.channels > 0 }
        guard let first = usable.first else { return [] }
        if usable.count == 1 {
            return first.samples.withUnsafeBufferPointer { resample(interleaved: $0, channels: first.channels) }
        }
        let frames = usable.map { $0.samples.count / $0.channels }.min() ?? 0
        var mixed = [Float](repeating: 0, count: frames)
        for buffer in usable {
            for frame in 0..<frames { mixed[frame] += buffer.samples[frame * buffer.channels] / Float(usable.count) }
        }
        return mixed.withUnsafeBufferPointer { resample(interleaved: $0, channels: 1) }
    }
}
