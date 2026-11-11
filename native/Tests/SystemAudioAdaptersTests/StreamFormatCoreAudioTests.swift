import CoreAudio
import Testing
@testable import SystemAudioAdapters
import SystemAudioCore

struct StreamFormatCoreAudioTests {
    @Test func readsTheFieldsTheHelperChecks() {
        var description = AudioStreamBasicDescription()
        description.mSampleRate = 16_000
        description.mChannelsPerFrame = 1
        description.mBitsPerChannel = 32
        description.mFormatFlags = kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked
        #expect(StreamFormat(description) == StreamFormat(sampleRate: 16_000, channelCount: 1, bitsPerChannel: 32, isFloat: true))
    }

    @Test func integerSamplesAreNotFloat() {
        var description = AudioStreamBasicDescription()
        description.mSampleRate = 48_000
        description.mChannelsPerFrame = 2
        description.mBitsPerChannel = 32
        description.mFormatFlags = kAudioFormatFlagIsSignedInteger
        #expect(StreamFormat(description).isFloat == false)
    }
}
