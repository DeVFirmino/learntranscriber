/// The audio format of a live session: mono little-endian PCM16 at 16 kHz, the format the desktop app sends.
public enum SessionAudio {
    /// Samples per second.
    public static let sampleRate = 16_000
    /// Bytes in one PCM16 sample.
    public static let bytesPerSample = 2
    /// The largest single read from standard input: 100 ms of audio. A larger coalesced read would average
    /// quiet speech into silence before the pause detector sees it.
    public static let maximumReadBytes = sampleRate / 10 * bytesPerSample

    /// The number of samples in `seconds` of audio.
    public static func samples(inSeconds seconds: Int) -> Int { sampleRate * seconds }
}
