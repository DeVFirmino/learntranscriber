import Foundation
import SpeechCore
import Testing

struct TaskRotationTests {
    @Test func rotatesAfterFiftySecondsOfAudio() {
        #expect(TaskRotation.maximumSamplesPerTask == 800_000)
        #expect(TaskRotation.shouldRotate(current: 800_000, adding: 1))
        #expect(TaskRotation.shouldRotate(current: 799_999, adding: 1) == false)
    }
}

struct SampleFramingTests {
    @Test func carriesAnOddTrailingByteIntoTheNextChunk() {
        var framing = SampleFraming()
        #expect(framing.frame(Data([1, 2, 3])) == Data([1, 2]))
        #expect(framing.hasDanglingByte)
        #expect(framing.frame(Data([4])) == Data([3, 4]))
        #expect(framing.hasDanglingByte == false)
    }
}

struct SessionAudioTests {
    @Test func oneReadHoldsAtMostOneTenthOfASecond() {
        #expect(SessionAudio.maximumReadBytes == 3_200)
    }
}
