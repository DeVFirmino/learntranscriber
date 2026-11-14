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

    // On-device Apple Speech restarts its transcription after a pause: the next partial and the final hold only the
    // words after it. A 25-minute class kept about a third of its speech before the tracker kept the dropped words.
    @Test func wordsDroppedByARestartStayInThePartialsAndTheFinal() {
        var tracker = UtteranceTracker()
        #expect(tracker.receive(.transcript("So today we look at one versus rest", isFinal: false))
            == .partial("So today we look at one versus rest"))
        #expect(tracker.receive(.transcript("Each class", isFinal: false))
            == .partial("So today we look at one versus rest Each class"))
        #expect(tracker.receive(.transcript("Each class gets its own classifier", isFinal: false))
            == .partial("So today we look at one versus rest Each class gets its own classifier"))
        #expect(tracker.receive(.transcript("The softmax", isFinal: false))
            == .partial("So today we look at one versus rest Each class gets its own classifier The softmax"))
        #expect(tracker.receive(.transcript("The softmax trains them jointly", isFinal: true))
            == .final("So today we look at one versus rest Each class gets its own classifier The softmax trains them jointly"))
        #expect(tracker.finish() == nil)
    }

    @Test func aFinalThatAlreadyHoldsTheWholeUtteranceIsNotRepeated() {
        var tracker = UtteranceTracker()
        _ = tracker.receive(.transcript("one two three four", isFinal: false))
        _ = tracker.receive(.transcript("five six", isFinal: false))
        #expect(tracker.receive(.transcript("One, two, three, four, five, six.", isFinal: true))
            == .final("One, two, three, four, five, six."))
    }

    @Test func revisionsOfTheOpeningWordsAreNotRestarts() {
        var tracker = UtteranceTracker()
        _ = tracker.receive(.transcript("hel", isFinal: false))
        #expect(tracker.receive(.transcript("hello there", isFinal: false)) == .partial("hello there"))
        _ = tracker.receive(.transcript("hello there the soft", isFinal: false))
        #expect(tracker.receive(.transcript("Hello there, the softmax", isFinal: false)) == .partial("Hello there, the softmax"))
        #expect(UtteranceTracker.restarted(from: "the class two is one", to: "class two exists") == false)
        #expect(UtteranceTracker.restarted(from: "digit recognition", to: "main") == true)
    }

    @Test func aDrainFailureOrNoSpeechAfterARestartKeepsTheEarlierWords() {
        var drained = UtteranceTracker()
        _ = drained.receive(.transcript("first part of the lecture", isFinal: false))
        _ = drained.receive(.transcript("second", isFinal: false))
        #expect(drained.finish() == "first part of the lecture second")

        var failed = UtteranceTracker()
        _ = failed.receive(.transcript("first part of the lecture", isFinal: false))
        _ = failed.receive(.transcript("second", isFinal: false))
        #expect(failed.receive(.failure("Recognition stopped")) == .final("first part of the lecture second"))

        var silent = UtteranceTracker()
        _ = silent.receive(.transcript("first part of the lecture", isFinal: false))
        _ = silent.receive(.transcript("um", isFinal: false))
        #expect(silent.receive(.noSpeech) == .final("first part of the lecture"), "only the retracted partial goes")
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
