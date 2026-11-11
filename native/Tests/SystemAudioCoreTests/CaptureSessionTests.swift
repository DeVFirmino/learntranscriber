import Foundation
import Testing
@testable import SystemAudioCore

@MainActor
struct CaptureSessionTests {
    private let capture: FakeCapture
    private let recorder = LineRecorder()

    init() {
        capture = FakeCapture()
    }

    private func session(for capture: FakeCapture, livePackets: Bool = false) -> CaptureSession {
        let recorder = recorder
        return CaptureSession(capture: capture, options: CaptureOptions(excludedBundleID: "x", livePackets: livePackets)) {
            recorder.write($0)
        }
    }

    @Test func aStopRequestStopsTheCaptureAndFlushesWhatWasBuffered() async throws {
        capture.continuation.yield(.audio(Data([1, 2])))
        capture.continuation.yield(.audio(Data([3])))
        let (stopRequests, stop) = AsyncStream<Void>.makeStream()
        stop.yield()
        try await session(for: capture).run(until: stopRequests)
        #expect(recorder.lines == [.started, .audio(Data([1, 2, 3])), .stopped])
        #expect(capture.stopCount == 1)
    }

    @Test func closingTheStopRequestsCountsAsAStop() async throws {
        let (stopRequests, stop) = AsyncStream<Void>.makeStream()
        stop.finish()
        try await session(for: capture).run(until: stopRequests)
        #expect(recorder.lines == [.started, .stopped])
        #expect(capture.stopCount == 1)
    }

    @Test func fullBatchesAreWrittenWithoutWaitingForAStop() async throws {
        capture.continuation.yield(.audio(Data(count: 3_200)))
        capture.continuation.yield(.audio(Data([9])))
        capture.continuation.finish()
        let (stopRequests, stop) = AsyncStream<Void>.makeStream()
        try await session(for: capture, livePackets: true).run(until: stopRequests)
        #expect(recorder.lines == [.started, .audio(Data(count: 3_200)), .audio(Data([9])), .stopped])
        withExtendedLifetime(stop) {}
    }

    @Test func otherEventsFlushTheBatchFirstSoLinesKeepTheirOrder() async throws {
        capture.continuation.yield(.audio(Data([1])))
        capture.continuation.yield(.reconnecting(reason: "default output changed"))
        capture.continuation.yield(.audio(Data([2])))
        capture.continuation.yield(.deviceChanged(id: "usb-1", name: "Desk Speakers"))
        capture.continuation.yield(.audio(Data([3])))
        capture.continuation.finish()
        let (stopRequests, stop) = AsyncStream<Void>.makeStream()
        try await session(for: capture).run(until: stopRequests)
        #expect(recorder.lines == [
            .started, .audio(Data([1])), .reconnecting("default output changed"), .audio(Data([2])),
            .deviceChanged(id: "usb-1", name: "Desk Speakers"), .audio(Data([3])), .stopped,
        ])
        #expect(capture.stopCount == 1, "a capture that ended on its own is still stopped")
        withExtendedLifetime(stop) {}
    }

    @Test func aFailedCaptureReportsItsErrorWithoutWaitingForAStop() async throws {
        capture.continuation.yield(.audio(Data([1])))
        capture.continuation.finish(throwing: CaptureFailure(message: "System audio stopped (lost)."))
        let (stopRequests, stop) = AsyncStream<Void>.makeStream()
        try await session(for: capture).run(until: stopRequests)
        #expect(recorder.lines == [.started, .audio(Data([1])), .failure("System audio stopped (lost)."), .stopped])
        #expect(capture.stopCount == 1)
        withExtendedLifetime(stop) {}
    }

    @Test func aFailedStartIsStoppedAndThrownWithoutWritingAnything() async {
        let failure = CaptureFailure(message: "No connected display is available.")
        let failing = FakeCapture(startFailure: failure)
        let (stopRequests, _) = AsyncStream<Void>.makeStream()
        let thrown = await #expect(throws: CaptureFailure.self) { try await session(for: failing).run(until: stopRequests) }
        #expect(thrown == failure)
        #expect(recorder.lines.isEmpty)
        #expect(failing.stopCount == 1)
    }
}
