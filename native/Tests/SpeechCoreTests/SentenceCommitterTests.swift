import SpeechCore
import Testing

struct SentenceCommitterTests {
    private let second = SessionAudio.samples(inSeconds: 1)

    @Test func finishedSentencesAreSavedAndTheRestStaysProvisional() {
        var committer = SentenceCommitter()
        let update = committer.update("So today we look at one versus rest. Each class gets", at: second)
        #expect(update == .init(finals: ["So today we look at one versus rest."], partial: "Each class gets"))
    }

    @Test func revisedSavedWordsAreFoundAgainSoNothingIsSavedTwice() {
        var committer = SentenceCommitter()
        _ = committer.update("So today we look at one versus rest. Each class", at: second)
        // Apple rewrote the saved sentence's punctuation and case while the next one grew.
        let update = committer.update("so today we look at one versus rest each class gets its own classifier", at: 2 * second)
        #expect(update == .init(finals: [], partial: "each class gets its own classifier"))
        #expect(committer.finish("So today we look at one versus rest. Each class gets its own classifier.")
            == "Each class gets its own classifier.")
    }

    @Test func aShortSentenceJoinsTheNextOne() {
        var committer = SentenceCommitter()
        let update = committer.update("Yes. So the model learns its weights. And", at: second)
        #expect(update == .init(finals: ["Yes. So the model learns its weights."], partial: "And"))
    }

    @Test func speechWithoutPunctuationIsSavedAfterSevenSeconds() {
        var committer = SentenceCommitter()
        let early = committer.update("so we have three output neurons in here", at: second)
        #expect(early == .init(finals: [], partial: "so we have three output neurons in here"))
        let late = committer.update("so we have three output neurons in here and one input layer", at: 8 * second)
        #expect(late == .init(finals: ["so we have three output neurons in here and one input layer"], partial: ""))
        let next = committer.update("so we have three output neurons in here and one input layer then softmax", at: 9 * second)
        #expect(next == .init(finals: [], partial: "then softmax"))
    }

    @Test func shortSpeechIsNotForcedOutEvenWhenLong() {
        var committer = SentenceCommitter()
        _ = committer.update("um so yes", at: 0)
        #expect(committer.update("um so yes right", at: 20 * second) == .init(finals: [], partial: "um so yes right"))
    }

    @Test func aRepeatOfTheLastSavedSentenceIsSkipped() {
        var committer = SentenceCommitter()
        _ = committer.update("The loudest neuron wins the vote.", at: second)
        committer.reset()
        #expect(committer.finish("The loudest neuron wins the vote!") == "", "a new task repeating the sentence")
        #expect(committer.finish("Then we normalize the scores.") == "Then we normalize the scores.")
    }

    @Test func aChangedFactIsNotARepeat() {
        var committer = SentenceCommitter()
        #expect(committer.update("The result is 100. The", at: second).finals == ["The result is 100."])
        committer.reset()
        #expect(committer.finish("The result is 200.") == "The result is 200.")
    }

    @Test func newSpeechThatRepeatsASavedWordIsKept() {
        var committer = SentenceCommitter()
        _ = committer.update("The model learns. The", at: second)
        #expect(committer.update("The model learns. The optimizer learns faster", at: 2 * second).partial
            == "The optimizer learns faster")
    }

    @Test func savedWordsRewrittenBeyondRecognitionAreSkippedByCount() {
        var committer = SentenceCommitter()
        _ = committer.update("Digit recognition comes first. Then", at: second)
        let update = committer.update("Visual tasks matter most later then softmax", at: 2 * second)
        #expect(update.partial == "later then softmax", "the first four words stand for the four saved ones")
    }

    @Test func finishingStartsTheNextUtteranceEmpty() {
        var committer = SentenceCommitter()
        _ = committer.update("This sentence is already saved. And this", at: second)
        #expect(committer.finish("This sentence is already saved. And this is not.") == "And this is not.")
        #expect(committer.update("A brand new utterance starts here", at: second).partial == "A brand new utterance starts here")
    }
}

struct TextAlignmentTests {
    @Test func theSavedWordsAreFoundDespiteRevisionsAtTheEdges() {
        let saved = TextAlignment.words("so today we look at one versus rest")
        let words = TextAlignment.words("So today, we look at one versus the rest, each class")
        #expect(TextAlignment.alignedEnd(of: saved, in: words, slack: 2) == 9)
        #expect(TextAlignment.alignedEnd(of: saved, in: TextAlignment.words("completely different words here"), slack: 2) == nil)
    }

    @Test func aSavedWordIsNotMatchedToTheSameWordSaidAgainLater() {
        let saved = TextAlignment.words("The model learns.")
        let words = TextAlignment.words("The model learns. The optimizer learns faster.")
        #expect(TextAlignment.alignedEnd(of: saved, in: words, slack: 2) == 3)
    }
}
