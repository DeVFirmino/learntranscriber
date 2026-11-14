import Foundation
import HelperKit
import Speech
import SpeechCore

/// Live on-device recognition for one speaker: PCM16 frames go in, partial and final events come out.
/// A task ends at each pause after speech (`PauseDetector`), so every utterance becomes final as soon as it is said,
/// and in any case after fifty seconds (`TaskRotation`). Within a task, finished sentences are saved as they are
/// said (`SentenceCommitter`), so long speech without a pause is not held until the task ends.
@MainActor
public final class StreamingRecognizer: LiveRecognizing {
    /// Receives every outcome of one task on the main actor.
    typealias OutcomeHandler = @MainActor @Sendable (StreamingTaskOutcome) -> Void

    private let identity: SessionIdentity
    private let sink: any SessionEventSink
    private let makeTask: (@escaping OutcomeHandler) -> any StreamingRecognitionTask
    private let drainTimeout: Duration
    private var task: (any StreamingRecognitionTask)?
    /// Numbers the tasks; a callback from any task but the current one is ignored.
    private var generation = 0
    private var samplesInTask = 0
    private var tracker = UtteranceTracker()
    private var sentences = SentenceCommitter()
    private var pauses: PauseDetector
    /// True while a task drains; its failure then ends the drain instead of being reported.
    private var finishing = false
    /// Resumed when the current task reports its last outcome, or when waiting for it is cancelled.
    private var taskEnded: CheckedContinuation<Void, Never>?

    /// Recognizes `identity`'s locale on this device with `SFSpeechRecognizer`, reporting to `sink`.
    ///
    /// - Throws: `SpeechFailure.unsupportedLocale` or `SpeechFailure.onDeviceUnavailable`.
    public convenience init(identity: SessionIdentity, sink: any SessionEventSink) throws {
        let recognizer = try SFSpeechRecognizer.onDevice(locale: identity.locale)
        self.init(identity: identity, sink: sink) { AppleStreamingTask(recognizer: recognizer, receive: $0) }
    }

    /// Recognizes with the tasks `makeTask` creates; `drainTimeout` bounds each drain.
    init(identity: SessionIdentity, sink: any SessionEventSink, drainTimeout: Duration = SpeechTimeouts.taskDrain,
         makeTask: @escaping (@escaping OutcomeHandler) -> any StreamingRecognitionTask) {
        self.identity = identity
        self.sink = sink
        self.makeTask = makeTask
        self.drainTimeout = drainTimeout
        pauses = PauseDetector(silenceLevel: PauseDetector.silenceLevel(for: identity.speaker))
    }

    public func announceReady() { sink.emit(identity.makeEvent(.ready, assetStatus: "available")) }

    /// Feeds whole PCM16 samples; ends the task at a pause after speech or when it reaches its limit.
    public func append(_ data: Data) async throws {
        guard data.count.isMultiple(of: SessionAudio.bytesPerSample) else { throw SpeechFailure.malformedAudio }
        let count = data.count / SessionAudio.bytesPerSample
        guard count > 0 else { return }
        if TaskRotation.shouldRotate(current: samplesInTask, adding: count) { await finishTask() }
        if task == nil { startTask() }
        let samples = PCM16.decode(data)
        try task?.append(samples)
        samplesInTask += count
        // A pause after recognized speech ends the utterance now instead of at the next rotation.
        if pauses.endsUtterance(after: samples), tracker.lastPartial.isEmpty == false { await finishTask() }
    }

    /// A capture source may stop sending buffers during silence. The input reader reports that gap explicitly.
    public func inputPaused() async { await finishTask() }

    /// Ends the current task, allowing the drain timeout for the recognizer to catch up with its queued audio.
    public func stop() async { await finishTask() }

    private func startTask() {
        generation += 1
        let current = generation
        samplesInTask = 0
        pauses = PauseDetector(silenceLevel: PauseDetector.silenceLevel(for: identity.speaker))
        tracker = UtteranceTracker()
        sentences.reset()
        task = makeTask { [weak self] outcome in self?.receive(outcome, generation: current) }
    }

    private func receive(_ outcome: StreamingTaskOutcome, generation: Int) {
        guard generation == self.generation else { return }
        switch tracker.receive(outcome) {
        case .partial(let text):
            let update = sentences.update(text, at: samplesInTask)
            for sentence in update.finals { sink.emit(identity.makeEvent(.final, text: sentence)) }
            sink.emit(identity.makeEvent(.partial, text: update.partial))
        case .final(let text):
            if let rest = sentences.finish(text) { sink.emit(identity.makeEvent(.final, text: rest)) }
        case nil: break
        }
        if case .failure(let message) = outcome, finishing == false {
            sink.emit(identity.makeEvent(.error, error: message))
        }
        if outcome.endsTask { endTask() }
    }

    private func finishTask() async {
        guard let task else { return }
        guard samplesInTask > 0 else {
            discardTask()
            return
        }
        finishing = true
        defer { finishing = false }
        task.endAudio()
        // Ending input does not mean recognition has caught up. Cancelling early could persist a stale partial
        // and reject the final callback containing the last words, especially for system audio.
        await Self.waitForTaskEnd(of: self, within: drainTimeout)
        if let text = tracker.finish(), let rest = sentences.finish(text) {
            sink.emit(identity.makeEvent(.final, text: rest))
        }
        discardTask()
    }

    /// Waits for `recognizer`'s current task to end, for `timeout` at most. Giving up, or being cancelled,
    /// is not an error: the caller then settles what the task has heard so far.
    private nonisolated static func waitForTaskEnd(of recognizer: StreamingRecognizer, within timeout: Duration) async {
        do {
            try await withTimeout(timeout, failure: SpeechFailure.timedOut) { await recognizer.waitForTaskEnd() }
        } catch {
            // Timed out or cancelled: the cancelled wait has already returned, so nothing is left running.
        }
    }

    /// Returns once the current task reports its last outcome. Cancelling the calling task returns at once,
    /// so a timed-out drain does not wait for a callback that may never come.
    private func waitForTaskEnd() async {
        await withTaskCancellationHandler {
            await withCheckedContinuation { continuation in
                if task == nil || Task.isCancelled { continuation.resume() }
                else { taskEnded = continuation }
            }
        } onCancel: {
            Task { @MainActor [weak self] in self?.resumeTaskEnded() }
        }
    }

    private func endTask() {
        task = nil
        resumeTaskEnded()
    }

    private func resumeTaskEnded() {
        taskEnded?.resume()
        taskEnded = nil
    }

    private func discardTask() {
        task?.cancel()
        endTask()
        generation += 1
    }
}
