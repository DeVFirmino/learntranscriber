import Foundation
@testable import SystemAudioCore

/// A capture whose events the test feeds; `stop()` finishes them, as the protocol requires.
@MainActor
final class FakeCapture: AudioCapturing {
    let continuation: AsyncThrowingStream<CaptureEvent, any Error>.Continuation
    private let events: AsyncThrowingStream<CaptureEvent, any Error>
    private let startFailure: (any Error)?
    private(set) var stopCount = 0

    init(startFailure: (any Error)? = nil) {
        (events, continuation) = AsyncThrowingStream<CaptureEvent, any Error>.makeStream()
        self.startFailure = startFailure
    }

    func start(_ options: CaptureOptions) async throws -> AsyncThrowingStream<CaptureEvent, any Error> {
        if let startFailure { throw startFailure }
        return events
    }

    func stop() async {
        stopCount += 1
        continuation.finish()
    }
}
