import Foundation

/// Reads standard input one chunk at a time, only when asked. The caller awaits `next()` after it has
/// handled the previous chunk, so a fast producer is held back by the pipe instead of filling memory.
/// Waiting polls the descriptor in short slices, so cancelling the awaiting task ends the wait even when
/// the writer keeps the pipe open without sending anything.
public struct StandardInputReader: Sendable {
    /// What one call to `next()` yields.
    public enum Chunk: Equatable, Sendable {
        /// Bytes that arrived; never empty.
        case bytes(Data)
        /// Nothing arrived for `idleTimeout` while the writer keeps the pipe open.
        case idle
        /// The writer closed the pipe.
        case end
    }

    private let fileDescriptor: Int32
    private let chunkSize: Int
    private let pollTimeoutMilliseconds: Int32
    private let idleTimeout: Duration?

    /// Creates a reader of `fileDescriptor` that returns at most `chunkSize` bytes per call.
    ///
    /// - Parameters:
    ///   - fileDescriptor: The descriptor to read; standard input by default.
    ///   - chunkSize: The most bytes one `.bytes` chunk holds.
    ///   - pollInterval: How long one wait for input lasts before cancellation is checked again.
    ///   - idleTimeout: How long without input makes `next()` report `.idle`; `nil` waits indefinitely.
    public init(fileDescriptor: Int32 = STDIN_FILENO, chunkSize: Int = 65_536,
                pollInterval: Duration = .milliseconds(100), idleTimeout: Duration? = nil) {
        self.fileDescriptor = fileDescriptor
        self.chunkSize = chunkSize
        self.pollTimeoutMilliseconds = Self.milliseconds(in: pollInterval)
        self.idleTimeout = idleTimeout
    }

    /// The next chunk: `.bytes` as soon as any arrive, `.idle` once `idleTimeout` passes without any,
    /// `.end` when the writer closes. Throws `CancellationError` when the task is cancelled.
    @concurrent
    public func next() async throws -> Chunk {
        var descriptor = pollfd(fd: fileDescriptor, events: Int16(POLLIN), revents: 0)
        let started = ContinuousClock.now
        while true {
            try Task.checkCancellation()
            let ready = poll(&descriptor, 1, pollTimeoutMilliseconds)
            if ready == 0 {
                if let idleTimeout, ContinuousClock.now - started >= idleTimeout { return .idle }
                continue
            }
            if ready < 0 {
                if errno == EINTR { continue }
                throw HelperError("Could not read standard input.")
            }
            var buffer = [UInt8](repeating: 0, count: chunkSize)
            let count = read(fileDescriptor, &buffer, chunkSize)
            if count > 0 { return .bytes(Data(buffer[0..<count])) }
            if count == 0 { return .end }
            if errno == EAGAIN || errno == EINTR { continue }
            throw HelperError("Could not read standard input.")
        }
    }

    /// `poll(2)` takes whole milliseconds; sub-millisecond parts are dropped and huge values clamped.
    private static func milliseconds(in duration: Duration) -> Int32 {
        let (seconds, attoseconds) = duration.components
        return Int32(clamping: seconds * 1_000 + attoseconds / 1_000_000_000_000_000)
    }
}
