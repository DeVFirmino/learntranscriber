import Foundation

/// One second of a synthetic tone in the helper format, so the pipeline can be checked without capturing anything.
public enum SelfTestTone {
    /// Phase advance per sample, in radians: about 102 Hz at 16 kHz.
    public static let phaseStep = 0.04
    /// Peak sample value, about an eighth of full scale.
    public static let amplitude = 4_000.0

    /// Returns one second of the tone as little-endian PCM16, starting at silence.
    ///
    /// Samples are truncated to `Int16` directly rather than through `PCM16.encode`, whose Float rounding would
    /// change a few samples of the line the app and its tests already know.
    public static func oneSecond() -> Data {
        var data = Data(capacity: HelperAudioFormat.bytesPerSecond)
        for index in 0..<HelperAudioFormat.sampleRate {
            var sample = Int16(sin(Double(index) * phaseStep) * amplitude).littleEndian
            withUnsafeBytes(of: &sample) { data.append(contentsOf: $0) }
        }
        return data
    }
}
