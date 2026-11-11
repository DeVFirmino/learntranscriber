/// A source of system audio. Capture objects live on the main actor.
///
/// The events stream is unbounded: audio arrives on a real-time framework queue that must never block, and the
/// command drains it as fast as it writes lines, so nothing is dropped and the backlog stays a few buffers deep.
@MainActor
public protocol AudioCapturing {
    /// Starts capturing and returns its events in order.
    ///
    /// A start that throws leaves nothing running. The stream fails when the capture stops on its own and
    /// finishes only through `stop()`; it has no termination handler, so the owner calls `stop()` once it is done
    /// with the stream, whichever side ended it.
    func start(_ options: CaptureOptions) async throws -> AsyncThrowingStream<CaptureEvent, any Error>

    /// Stops capturing, releases every system resource and finishes the stream; events already buffered are
    /// still delivered. Safe to call more than once, and after a failed `start`.
    func stop() async
}
