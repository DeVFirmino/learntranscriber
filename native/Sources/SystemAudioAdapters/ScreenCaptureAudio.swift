import CoreGraphics
import CoreMedia
import Foundation
import HelperKit
import ScreenCaptureKit
import SystemAudioCore

/// Captures system audio with one audio-only SCStream for the display the app chose.
@MainActor
public final class ScreenCaptureAudio: AudioCapturing {
    /// ScreenCaptureKit always captures video too; the smallest frame once a second keeps that cost negligible.
    private static let videoFrameSide = 2
    private static let videoFrameInterval = CMTime(value: 1, timescale: 1)

    private var stream: SCStream?
    private var forwarder: SampleForwarder?
    /// Sample buffers arrive on this queue; ScreenCaptureKit requires one.
    private let sampleQueue = DispatchQueue(label: "dev.learntranscriber.audio")

    /// Creates an idle capture.
    public init() {}

    /// Whether Screen & System Audio Recording is granted, checked without prompting.
    nonisolated public static var isAccessGranted: Bool { CGPreflightScreenCaptureAccess() }

    public func start(_ options: CaptureOptions) async throws -> AsyncThrowingStream<CaptureEvent, any Error> {
        let content: SCShareableContent
        do {
            content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        } catch {
            throw Self.startFailure(error)
        }
        guard let display = content.displays.first(where: { $0.displayID == options.displayID }) ?? content.displays.first else {
            throw HelperError("No connected display is available.")
        }
        let excluded = content.applications.filter { $0.bundleIdentifier == options.excludedBundleID }
        let filter = SCContentFilter(display: display, excludingApplications: excluded, exceptingWindows: [])
        let (events, continuation) = AsyncThrowingStream<CaptureEvent, any Error>.makeStream()
        let forwarder = SampleForwarder(continuation: continuation)
        let stream = SCStream(filter: filter, configuration: Self.makeConfiguration(), delegate: forwarder)
        do {
            try stream.addStreamOutput(forwarder, type: .audio, sampleHandlerQueue: sampleQueue)
            try await stream.startCapture()
        } catch {
            continuation.finish()
            throw Self.startFailure(error)
        }
        self.stream = stream
        self.forwarder = forwarder
        return events
    }

    public func stop() async {
        try? await stream?.stopCapture()
        stream = nil
        forwarder?.continuation.finish()
        forwarder = nil
    }

    /// Audio in the helper's rate and channel count, from the app's audio only, with the least video possible.
    private static func makeConfiguration() -> SCStreamConfiguration {
        let configuration = SCStreamConfiguration()
        configuration.width = videoFrameSide
        configuration.height = videoFrameSide
        configuration.minimumFrameInterval = videoFrameInterval
        configuration.capturesAudio = true
        configuration.excludesCurrentProcessAudio = true
        configuration.sampleRate = HelperAudioFormat.sampleRate
        configuration.channelCount = HelperAudioFormat.channelCount
        return configuration
    }

    /// The person-facing failure for a framework error during start, keeping the framework's own description.
    private static func startFailure(_ error: any Error) -> HelperError {
        HelperError(
            "Native system audio could not start (\(error.localizedDescription)). Enable Screen & System Audio Recording for LearnTranscriber, then retry.")
    }
}
