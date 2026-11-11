import Foundation
import HelperKit
import SystemAudioCore

/// The app's stop requests on standard input: one element per `stop` line, ending when the app closes its end.
///
/// Reading polls the descriptor, so cancelling the iterating task ends the wait even while the app keeps the pipe
/// open; `FileHandle.AsyncBytes` waits for the next byte or the end of input instead.
public struct StopRequests: AsyncSequence, Sendable {
    public typealias Element = Void

    private let reader: StandardInputReader

    /// Reads requests from `reader`, standard input by default.
    public init(reader: StandardInputReader = StandardInputReader(chunkSize: 4_096)) {
        self.reader = reader
    }

    public func makeAsyncIterator() -> Iterator { Iterator(reader: reader) }

    /// Yields once per `stop` line.
    public struct Iterator: AsyncIteratorProtocol {
        private let reader: StandardInputReader
        private var scanner = StopLineScanner()

        init(reader: StandardInputReader) { self.reader = reader }

        /// Waits for the next `stop` line; returns `nil` once input ends. Throws `CancellationError` when cancelled.
        public mutating func next() async throws -> Void? {
            while true {
                switch try await reader.next() {
                case .bytes(let bytes):
                    if scanner.scan(bytes) { return () }
                case .idle:
                    continue
                case .end:
                    return nil
                }
            }
        }
    }
}
