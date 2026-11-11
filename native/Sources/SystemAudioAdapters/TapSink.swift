import CoreAudio
import Foundation
import HelperKit
import os
import SystemAudioCore

/// Converts tap buffers on Core Audio's I/O queue and forwards helper-format audio to the stream. The resampler
/// is shared with the main actor, which retunes it after a move, so it sits behind a lock.
struct TapSink: Sendable {
    let continuation: AsyncThrowingStream<CaptureEvent, any Error>.Continuation
    private let resampler = OSAllocatedUnfairLock(initialState: MonoResampler(sourceRate: Double(HelperAudioFormat.sampleRate)))

    init(continuation: AsyncThrowingStream<CaptureEvent, any Error>.Continuation) {
        self.continuation = continuation
    }

    /// Resamples from `sampleRate` from now on; a new output may run at another rate, and the stream carries on.
    func follow(sampleRate: Double) {
        resampler.withLock { resampler in
            if resampler.sourceRate != sampleRate { resampler = MonoResampler(sourceRate: sampleRate) }
        }
    }

    /// The IOProc block that feeds this sink. It is formed here, outside the main actor, because Core Audio calls
    /// it on its own queue.
    func makeIOBlock() -> AudioDeviceIOBlock {
        { _, input, _, _, _ in consume(input) }
    }

    /// Mixes one tap buffer list to mono at the helper rate and yields it as PCM16.
    private func consume(_ list: UnsafePointer<AudioBufferList>) {
        let buffers = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: list)).map { buffer in
            let count = Int(buffer.mDataByteSize) / MemoryLayout<Float>.size
            let samples = buffer.mData.map { Array(UnsafeBufferPointer(start: $0.assumingMemoryBound(to: Float.self), count: count)) } ?? []
            return SampleBuffer(samples: samples, channels: Int(buffer.mNumberChannels))
        }
        let mono = resampler.withLock { $0.resample(planar: buffers) }
        if mono.isEmpty == false { continuation.yield(.audio(PCM16.encode(mono))) }
    }
}
