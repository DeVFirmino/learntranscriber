import Foundation

/// Conversions between the Float32 audio Apple frameworks produce and the little-endian
/// 16-bit PCM the desktop app exchanges with its helpers.
public enum PCM16 {
    /// Clamps each sample to [-1, 1] and encodes it as little-endian Int16.
    public static func encode(_ samples: some Sequence<Float>) -> Data {
        var data = Data()
        for value in samples {
            let clamped = value.isFinite ? max(-1, min(1, value)) : 0
            var sample = Int16(clamped < 0 ? clamped * 32768 : clamped * 32767).littleEndian
            withUnsafeBytes(of: &sample) { data.append(contentsOf: $0) }
        }
        return data
    }

    /// Decodes little-endian Int16 samples into floats in [-1, 1]. `data` must hold whole samples.
    public static func decode(_ data: Data) -> [Float] {
        let count = data.count / 2
        var samples = [Float](repeating: 0, count: count)
        for index in 0..<count {
            let low = UInt16(data[data.startIndex + index * 2])
            let high = UInt16(data[data.startIndex + index * 2 + 1]) << 8
            samples[index] = Float(Int16(bitPattern: low | high)) / 32_768
        }
        return samples
    }
}
