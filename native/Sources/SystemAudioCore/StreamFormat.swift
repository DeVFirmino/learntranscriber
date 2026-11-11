/// The sample layout a capture framework reports for a stream, reduced to what the helper checks.
public struct StreamFormat: Equatable, Sendable {
    /// Frames per second.
    public var sampleRate: Double
    /// Channels per frame.
    public var channelCount: Int
    /// Bits in one sample of one channel.
    public var bitsPerChannel: Int
    /// Whether samples are floating point rather than integers.
    public var isFloat: Bool

    /// Creates a format from the values a framework reported.
    public init(sampleRate: Double, channelCount: Int, bitsPerChannel: Int, isFloat: Bool) {
        self.sampleRate = sampleRate
        self.channelCount = channelCount
        self.bitsPerChannel = bitsPerChannel
        self.isFloat = isFloat
    }

    /// Whether samples are Float32, the only sample type the helper converts.
    public var isFloat32: Bool { isFloat && bitsPerChannel == 32 }

    /// Whether this is the helper's rate and channel count as Float32, which ScreenCaptureKit is configured to
    /// deliver; anything else is skipped rather than converted.
    public var isHelperFormat: Bool {
        isFloat32 && sampleRate == Double(HelperAudioFormat.sampleRate) && channelCount == HelperAudioFormat.channelCount
    }
}
