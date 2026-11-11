/// What the app asked the helper to capture.
public struct CaptureOptions: Equatable, Sendable {
    /// Audio gathered per packet for live captions: a tenth of a second, so speech from the other side reaches
    /// recognition at once and a sentence's end is never held back waiting for more audio.
    public static let livePacketDuration = Duration.milliseconds(100)
    /// Audio gathered per packet for segment transcription.
    public static let segmentPacketDuration = Duration.seconds(8)

    /// The display whose audio ScreenCaptureKit captures; `nil` means the first connected display. The process
    /// tap ignores it: it always follows the default output.
    public var displayID: UInt32?
    /// The app's own bundle, excluded so it never transcribes itself.
    public var excludedBundleID: String
    /// Live captions want smaller, more frequent packets than segment transcription.
    public var livePackets: Bool

    /// Creates the options for one capture.
    public init(displayID: UInt32? = nil, excludedBundleID: String, livePackets: Bool = false) {
        self.displayID = displayID
        self.excludedBundleID = excludedBundleID
        self.livePackets = livePackets
    }

    /// Bytes of PCM16 gathered before a packet is written.
    public var packetBytes: Int {
        HelperAudioFormat.byteCount(for: livePackets ? Self.livePacketDuration : Self.segmentPacketDuration)
    }
}
