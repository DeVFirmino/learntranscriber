import Foundation
import SpeechCore
import Testing
@testable import SpeechAdapters

@MainActor
struct StreamingRecognizerTests {
    private let prefix = "Qual é a melhor forma de reduzir os custos"
    private let full = "Qual é a melhor forma de reduzir os custos de infraestrutura?"
    /// About 0.03 RMS: speech for both silence gates.
    private let speech: Int16 = 1_000
    /// About 0.004 RMS: quiet system speech, silence only for the microphone gate.
    private let quietSpeech: Int16 = 130

    @Test func aFinalDeliveredAfterTheAudioEndsIsStillEmitted() async throws {
        let (recognizer, sink, tasks) = try makeRecognizer()
        try await recognizer.append(pcm(speech))
        tasks.last?.receive?(.transcript(prefix, isFinal: false))
        let full = full
        tasks.last?.onEnd = { engine in
            // The recognizer catches up with its queued audio some time after the input ends.
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(50))
                engine.receive?(.transcript(full, isFinal: true))
            }
        }
        await recognizer.inputPaused()
        #expect(sink.finals == [full], "settling the partial early would lose the last words")
        #expect(tasks.last?.ended == true)
    }

    @Test func aDrainThatNeverEndsSettlesThePartialAfterTheTimeout() async throws {
        let (recognizer, sink, tasks) = try makeRecognizer(drainTimeout: .milliseconds(50))
        try await recognizer.append(pcm(speech))
        tasks.last?.receive?(.transcript(prefix, isFinal: false))
        await recognizer.stop()
        #expect(sink.finals == [prefix])
        #expect(tasks.last?.cancelled == true)
    }

    @Test func quietTrailingWordsDoNotCloseTheTaskBeforeActualSilence() async throws {
        let (recognizer, sink, tasks) = try makeRecognizer()
        try await recognizer.append(pcm(3_000))
        let task = try #require(tasks.last)
        task.receive?(.transcript(prefix, isFinal: false))
        let full = full
        task.onEnd = { $0.receive?(.transcript(full, isFinal: true)) }
        for _ in 0..<12 { try await recognizer.append(pcm(quietSpeech)) }
        #expect(task.ended == false, "quiet system output is still speech")
        for _ in 0..<9 { try await recognizer.append(pcm(0)) }
        #expect(task.ended)
        #expect(sink.finals == [full])
    }

    @Test func inputGapFinalizesWithoutRequiringSilentAudioPackets() async throws {
        let (recognizer, sink, tasks) = try makeRecognizer()
        try await recognizer.append(pcm(speech))
        let full = full
        tasks.last?.receive?(.transcript(full, isFinal: false))
        tasks.last?.onEnd = { $0.receive?(.transcript(full, isFinal: true)) }
        await recognizer.inputPaused()
        await recognizer.inputPaused()
        await recognizer.stop()
        #expect(sink.finals == [full])
    }

    @Test func noSpeechEndsOnlyTheUtteranceAndTheNextAudioStartsANewTask() async throws {
        let (recognizer, sink, tasks) = try makeRecognizer(speaker: "ME")
        try await recognizer.append(pcm(0))
        tasks[0].receive?(.noSpeech)
        #expect(sink.events.contains { $0.kind == .error } == false)
        #expect(sink.events.last == SessionEvent(kind: .final, sessionId: "test", speakerLabel: "ME", text: "", resolvedLocale: "pt-BR"))
        try await recognizer.append(pcm(speech))
        #expect(tasks.count == 2)
        tasks[1].receive?(.transcript("What is dependency injection?", isFinal: true))
        #expect(sink.events.last?.text == "What is dependency injection?")
    }

    @Test func noSpeechDuringADrainDoesNotCommitTheRetractedPartial() async throws {
        let (recognizer, sink, tasks) = try makeRecognizer()
        try await recognizer.append(pcm(speech))
        tasks.last?.receive?(.transcript("uh", isFinal: false))
        tasks.last?.onEnd = { $0.receive?(.noSpeech) }
        await recognizer.stop()
        #expect(sink.finals == [""], "one empty final, not a second final with the partial")
    }

    @Test func aFailureMidStreamKeepsThePartialReportsTheErrorAndRecovers() async throws {
        let (recognizer, sink, tasks) = try makeRecognizer()
        try await recognizer.append(pcm(speech))
        tasks[0].receive?(.transcript(prefix, isFinal: false))
        tasks[0].receive?(.failure("Recognition stopped"))
        #expect(sink.events.map(\.kind) == [.partial, .final, .error])
        #expect(sink.finals == [prefix])
        #expect(sink.events.last == SessionEvent(kind: .error, sessionId: "test", speakerLabel: "THEY", error: "Recognition stopped"))
        try await recognizer.append(pcm(speech))
        #expect(tasks.count == 2, "the next audio starts a new task")
    }

    @Test func fiftySecondsOfSpeechRotateTheTaskAndLateCallbacksAreIgnored() async throws {
        let (recognizer, sink, tasks) = try makeRecognizer(onEnd: { $0.receive?(.transcript("first fifty seconds", isFinal: true)) })
        let oneSecond = pcm(speech, count: SessionAudio.sampleRate)
        for _ in 0..<50 { try await recognizer.append(oneSecond) }
        #expect(tasks.count == 1, "exactly fifty seconds still fit in one task")
        try await recognizer.append(oneSecond)
        #expect(tasks.count == 2)
        #expect(tasks[0].ended)
        #expect(sink.finals == ["first fifty seconds"])
        let before = sink.events
        tasks[0].receive?(.transcript("late", isFinal: true))
        tasks[0].receive?(.failure("late failure"))
        #expect(sink.events == before, "a finished task's callbacks no longer reach the session")
    }

    @Test func finishedSentencesAreSavedWhileTheSpeakerKeepsTalking() async throws {
        let (recognizer, sink, tasks) = try makeRecognizer(onEnd: { engine in
            engine.receive?(.transcript("Softmax picks one class. Sigmoid can pick several classes.", isFinal: true))
        })
        try await recognizer.append(pcm(speech))
        tasks.last?.receive?(.transcript("Softmax picks one class. Sigmoid can", isFinal: false))
        #expect(sink.finals == ["Softmax picks one class."], "saved before the task ends")
        #expect(sink.events.last?.text == "Sigmoid can")
        await recognizer.stop()
        #expect(sink.finals == ["Softmax picks one class.", "Sigmoid can pick several classes."])
    }

    @Test func anOddByteCountIsMalformedAudio() async throws {
        let (recognizer, _, _) = try makeRecognizer()
        await #expect(throws: SpeechFailure.malformedAudio) { try await recognizer.append(Data([1, 2, 3])) }
    }

    @Test func announcingReadyReportsTheAvailableAssets() throws {
        let (recognizer, sink, _) = try makeRecognizer()
        recognizer.announceReady()
        #expect(sink.events == [SessionEvent(kind: .ready, sessionId: "test", speakerLabel: "THEY", resolvedLocale: "pt-BR", assetStatus: "available")])
    }

    private func makeRecognizer(speaker: String = "THEY", drainTimeout: Duration = SpeechTimeouts.taskDrain,
                                onEnd: ((Engine) -> Void)? = nil) throws -> (StreamingRecognizer, Sink, Tasks) {
        let sink = Sink()
        let tasks = Tasks()
        let recognizer = StreamingRecognizer(
            identity: try SessionIdentity(sessionId: "test", speakerLabel: speaker, language: "pt-BR"),
            sink: sink, drainTimeout: drainTimeout) { receive in
                let engine = Engine()
                engine.receive = receive
                engine.onEnd = onEnd
                tasks.all.append(engine)
                return engine
            }
        return (recognizer, sink, tasks)
    }

    private func pcm(_ sample: Int16, count: Int = 1_600) -> Data {
        [Int16](repeating: sample.littleEndian, count: count).withUnsafeBytes { Data($0) }
    }

    private final class Sink: SessionEventSink {
        var events: [SessionEvent] = []
        var finals: [String?] { events.filter { $0.kind == .final }.map(\.text) }
        func emit(_ event: SessionEvent) { events.append(event) }
    }

    /// Every task the recognizer created, in order.
    private final class Tasks {
        var all: [Engine] = []
        var count: Int { all.count }
        var last: Engine? { all.last }
        subscript(index: Int) -> Engine { all[index] }
    }

    private final class Engine: StreamingRecognitionTask {
        var receive: StreamingRecognizer.OutcomeHandler?
        var onEnd: ((Engine) -> Void)?
        var ended = false
        var cancelled = false
        func append(_ samples: [Float]) throws {}
        func endAudio() { ended = true; onEnd?(self) }
        func cancel() { cancelled = true }
    }
}

struct StreamingTaskOutcomeClassificationTests {
    @Test func noSpeechIsTheEndOfAnUtterance() {
        let silence = NSError(domain: "kAFAssistantErrorDomain", code: 1110, userInfo: [NSLocalizedDescriptionKey: "No speech detected"])
        #expect(StreamingTaskOutcome(text: nil, isFinal: false, error: silence) == .noSpeech)
    }

    @Test(arguments: [("kAFAssistantErrorDomain", 1700), ("OtherDomain", 1110)])
    func otherErrorsAreFailures(domain: String, code: Int) {
        let error = NSError(domain: domain, code: code, userInfo: [NSLocalizedDescriptionKey: "Permission required"])
        #expect(StreamingTaskOutcome(text: nil, isFinal: false, error: error) == .failure("Permission required"))
    }

    @Test func resultsWithoutAnErrorAreTranscripts() {
        #expect(StreamingTaskOutcome(text: "oi", isFinal: true, error: nil) == .transcript("oi", isFinal: true))
        #expect(StreamingTaskOutcome(text: nil, isFinal: false, error: nil) == .transcript("", isFinal: false))
    }
}
