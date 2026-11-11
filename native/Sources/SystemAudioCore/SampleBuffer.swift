/// The Float32 samples of one buffer in an audio buffer list; a buffer may hold several interleaved channels.
public struct SampleBuffer: Equatable, Sendable {
    /// The samples, `channels` per frame.
    public var samples: [Float]
    /// Interleaved channels in `samples`.
    public var channels: Int

    /// Creates a buffer of `samples` holding `channels` interleaved channels.
    public init(samples: [Float], channels: Int) {
        self.samples = samples
        self.channels = channels
    }
}
