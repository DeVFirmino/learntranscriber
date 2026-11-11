/// Recognises the app's `stop` request in standard input, which arrives in chunks of any size.
///
/// A line ends at `\n`, `\r` or `\r\n`; only a line that is exactly `stop` counts. A longer line is skipped
/// without being kept, so the scanner holds at most a few bytes whatever the app writes.
public struct StopLineScanner: Sendable {
    private static let request = Array("stop".utf8)
    private var line: [UInt8] = []
    private var isOverlong = false

    /// Creates a scanner at the start of a line.
    public init() {}

    /// Reads `bytes` and returns whether they completed a `stop` line; bytes after that line are not read.
    public mutating func scan(_ bytes: some Sequence<UInt8>) -> Bool {
        for byte in bytes {
            if byte == UInt8(ascii: "\n") || byte == UInt8(ascii: "\r") {
                let isRequest = isOverlong == false && line == Self.request
                line.removeAll(keepingCapacity: true)
                isOverlong = false
                if isRequest { return true }
            } else if isOverlong == false {
                line.append(byte)
                if line.count > Self.request.count {
                    line.removeAll(keepingCapacity: true)
                    isOverlong = true
                }
            }
        }
        return false
    }
}
