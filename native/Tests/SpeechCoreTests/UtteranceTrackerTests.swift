import SpeechCore
import Testing

struct UtteranceTrackerTests {
    @Test func repeatsNoPartialAndClearsOnFinal() {
        var tracker = UtteranceTracker()
        #expect(tracker.receive(.transcript("hel", isFinal: false)) == .partial("hel"))
        #expect(tracker.receive(.transcript("hel", isFinal: false)) == nil)
        #expect(tracker.receive(.transcript("hello", isFinal: false)) == .partial("hello"))
        #expect(tracker.receive(.transcript("hello world", isFinal: true)) == .final("hello world"))
        #expect(tracker.finish() == nil, "a final result leaves nothing to flush")
    }

    @Test func blankPartialsAreIgnoredAndTheLastPartialBecomesFinalOnFinish() {
        var tracker = UtteranceTracker()
        #expect(tracker.receive(.transcript("  ", isFinal: false)) == nil)
        #expect(tracker.receive(.transcript("", isFinal: true)) == nil, "a blank final with nothing heard emits nothing")
        _ = tracker.receive(.transcript("last words", isFinal: false))
        #expect(tracker.finish() == "last words")
        #expect(tracker.finish() == nil)
    }

    @Test func aBlankFinalSettlesTheLastPartial() {
        var tracker = UtteranceTracker()
        _ = tracker.receive(.transcript("last words", isFinal: false))
        #expect(tracker.receive(.transcript(" ", isFinal: true)) == .final("last words"))
        #expect(tracker.finish() == nil, "the partial is settled once")
    }

    @Test func noSpeechAfterAPartialEmitsOneEmptyFinalAndRetractsThePartial() {
        var tracker = UtteranceTracker()
        _ = tracker.receive(.transcript("uh", isFinal: false))
        #expect(tracker.receive(.noSpeech) == .final(""))
        #expect(tracker.finish() == nil, "a drain after no speech must not commit the retracted partial")
    }

    @Test func aFailureKeepsTheWordsHeardBeforeIt() {
        var tracker = UtteranceTracker()
        _ = tracker.receive(.transcript("words before the failure", isFinal: false))
        #expect(tracker.receive(.failure("Recognition stopped")) == .final("words before the failure"))
        #expect(tracker.receive(.failure("Recognition stopped")) == nil, "nothing is left to settle")
    }
}

struct StreamingTaskOutcomeTests {
    @Test(arguments: [
        (StreamingTaskOutcome.transcript("partial", isFinal: false), false),
        (.transcript("final", isFinal: true), true),
        (.noSpeech, true),
        (.failure("stopped"), true),
    ])
    func onlyAPartialKeepsTheTaskRunning(outcome: StreamingTaskOutcome, endsTask: Bool) {
        #expect(outcome.endsTask == endsTask)
    }
}
