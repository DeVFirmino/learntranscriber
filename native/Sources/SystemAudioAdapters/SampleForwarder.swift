import CoreMedia
import Foundation
import HelperKit
import ScreenCaptureKit
import SystemAudioCore

/// Receives sample buffers off the main actor and forwards helper-format audio to the stream.
final class SampleForwarder: NSObject, SCStreamOutput, SCStreamDelegate, Sendable {
    /// The largest sample buffer converted; ScreenCaptureKit delivers a few kilobytes at a time.
    private static let maximumBufferBytes = 1_000_000

    let continuation: AsyncThrowingStream<CaptureEvent, any Error>.Continuation

    init(continuation: AsyncThrowingStream<CaptureEvent, any Error>.Continuation) { self.continuation = continuation }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio, let pcm = Self.pcm16(from: sampleBuffer) else { return }
        continuation.yield(.audio(pcm))
    }

    func stream(_ stream: SCStream, didStopWithError error: any Error) {
        continuation.finish(throwing: HelperError(
            "System audio stopped (\(error.localizedDescription)). Check Screen & System Audio Recording for LearnTranscriber and the selected display."))
    }

    /// Converts a buffer in the helper format to PCM16; any other format is skipped.
    private static func pcm16(from sampleBuffer: CMSampleBuffer) -> Data? {
        guard CMSampleBufferIsValid(sampleBuffer),
              let format = sampleBuffer.formatDescription,
              let description = CMAudioFormatDescriptionGetStreamBasicDescription(format),
              StreamFormat(description.pointee).isHelperFormat,
              let block = CMSampleBufferGetDataBuffer(sampleBuffer) else { return nil }
        let size = CMBlockBufferGetDataLength(block)
        guard size > 0, size <= maximumBufferBytes else { return nil }
        var bytes = Data(count: size)
        let status = bytes.withUnsafeMutableBytes { pointer in
            guard let destination = pointer.baseAddress else { return kCMBlockBufferBadPointerParameterErr }
            return CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: size, destination: destination)
        }
        guard status == kCMBlockBufferNoErr else { return nil }
        return bytes.withUnsafeBytes { PCM16.encode($0.bindMemory(to: Float.self)) }
    }
}
