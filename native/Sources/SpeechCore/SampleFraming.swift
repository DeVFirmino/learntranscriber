import Foundation

/// Splits a byte stream into whole 16-bit samples, carrying a trailing odd byte to the next chunk.
public struct SampleFraming: Equatable, Sendable {
    /// The byte held back from the previous chunk; empty or one byte.
    public private(set) var carry = Data()

    /// Creates a framing that holds nothing back.
    public init() {}

    /// Returns the even-length chunk to decode now, holding back a trailing odd byte.
    public mutating func frame(_ bytes: Data) -> Data {
        var chunk = carry
        chunk.append(bytes)
        if chunk.count.isMultiple(of: SessionAudio.bytesPerSample) {
            carry.removeAll()
        } else {
            carry = Data(chunk.suffix(1))
            chunk.removeLast()
        }
        return chunk
    }

    /// True when the stream ended mid-sample, which the protocol treats as malformed audio.
    public var hasDanglingByte: Bool { carry.isEmpty == false }
}
