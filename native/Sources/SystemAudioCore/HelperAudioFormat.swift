/// The audio every helper exchanges with the desktop app: 16 kHz mono little-endian PCM16.
public enum HelperAudioFormat {
    /// Samples per second.
    public static let sampleRate = 16_000
    /// Channels per frame.
    public static let channelCount = 1
    /// Bytes in one PCM16 sample.
    public static let bytesPerSample = MemoryLayout<Int16>.size
    /// Bytes of PCM16 in one second of audio.
    public static let bytesPerSecond = sampleRate * channelCount * bytesPerSample

    /// Returns how many bytes of PCM16 last `duration`, rounded to whole frames.
    public static func byteCount(for duration: Duration) -> Int {
        let frames = (duration / .seconds(1) * Double(sampleRate)).rounded()
        return Int(frames) * channelCount * bytesPerSample
    }
}
