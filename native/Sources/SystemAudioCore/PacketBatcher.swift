import Foundation

/// Gathers PCM16 chunks and releases them as packets once `limit` bytes have accumulated.
public struct PacketBatcher: Sendable {
    /// Bytes that make a full packet.
    public let limit: Int
    private var pending = Data()

    /// Creates an empty batcher that releases packets of at least `limit` bytes.
    public init(limit: Int) { self.limit = limit }

    /// Adds `chunk` and returns the packet to write, if the batch is full.
    public mutating func append(_ chunk: Data) -> Data? {
        pending.append(chunk)
        return pending.count >= limit ? flush() : nil
    }

    /// Returns whatever is pending, or `nil` when there is nothing to write.
    public mutating func flush() -> Data? {
        guard pending.isEmpty == false else { return nil }
        defer { pending.removeAll(keepingCapacity: true) }
        return pending
    }
}
