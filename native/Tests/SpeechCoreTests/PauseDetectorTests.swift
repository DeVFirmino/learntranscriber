import SpeechCore
import Testing

struct PauseDetectorTests {
    private func chunk(_ level: Float, seconds: Double = 0.1) -> [Float] {
        [Float](repeating: level, count: Int(Double(SessionAudio.sampleRate) * seconds))
    }

    /// Feeds chunks in order and returns which of them ended an utterance.
    private func pauses(_ levels: [Float], silenceLevel: Float = PauseDetector.systemSilenceLevel) -> [Int] {
        var detector = PauseDetector(silenceLevel: silenceLevel)
        var ended: [Int] = []
        for (index, level) in levels.enumerated() where detector.endsUtterance(after: chunk(level)) { ended.append(index) }
        return ended
    }

    @Test func silenceAloneNeverEndsAnUtterance() {
        #expect(pauses(Array(repeating: 0.0001, count: 30)).isEmpty)
    }

    @Test func speechThenNineTenthsOfASecondOfSilenceEndsItOnce() {
        let levels: [Float] = [0.2] + Array(repeating: 0.0001, count: 20)
        #expect(pauses(levels) == [9])
    }

    @Test(arguments: [(Speaker.me, PauseDetector.microphoneSilenceLevel), (.they, PauseDetector.systemSilenceLevel)])
    func eachSpeakerHasItsOwnGate(speaker: Speaker, level: Float) {
        #expect(PauseDetector.silenceLevel(for: speaker) == level)
    }

    @Test func microphoneNoiseBetweenWordsStillCountsAsSilence() {
        // A noise-suppressed microphone measured between 0 and about 0.003 when nobody spoke.
        let noise: [Float] = [0.003, 0, 0.002, 0.0008, 0.0027, 0, 0.001, 0.002, 0.0005]
        #expect(pauses([0.2] + noise, silenceLevel: PauseDetector.microphoneSilenceLevel) == [9])
        #expect(pauses([0.2] + noise, silenceLevel: PauseDetector.systemSilenceLevel).isEmpty)
    }

    @Test func quietSystemSpeechIsNotSilence() {
        let quiet: [Float] = Array(repeating: 0.004, count: 12)
        #expect(pauses([0.2] + quiet, silenceLevel: PauseDetector.systemSilenceLevel).isEmpty)
    }

    @Test func speakingAgainRestartsTheSilenceCount() {
        let levels: [Float] = [0.2] + Array(repeating: 0.0001, count: 5) + [0.2] + Array(repeating: 0.0001, count: 9)
        #expect(pauses(levels) == [15])
    }
}
