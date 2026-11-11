import Testing
@testable import SystemAudioCore

struct StreamFormatTests {
    @Test(arguments: [
        (StreamFormat(sampleRate: 16_000, channelCount: 1, bitsPerChannel: 32, isFloat: true), true),
        (StreamFormat(sampleRate: 48_000, channelCount: 1, bitsPerChannel: 32, isFloat: true), false),
        (StreamFormat(sampleRate: 16_000, channelCount: 2, bitsPerChannel: 32, isFloat: true), false),
        (StreamFormat(sampleRate: 16_000, channelCount: 1, bitsPerChannel: 16, isFloat: false), false),
        (StreamFormat(sampleRate: 16_000, channelCount: 1, bitsPerChannel: 32, isFloat: false), false),
        (StreamFormat(sampleRate: 16_000, channelCount: 1, bitsPerChannel: 64, isFloat: true), false),
    ])
    func acceptsOnlyMonoFloat32AtTheHelperRate(format: StreamFormat, isHelperFormat: Bool) {
        #expect(format.isHelperFormat == isHelperFormat)
    }

    @Test func float32IsIndependentOfRateAndChannels() {
        #expect(StreamFormat(sampleRate: 48_000, channelCount: 2, bitsPerChannel: 32, isFloat: true).isFloat32)
        #expect(StreamFormat(sampleRate: 48_000, channelCount: 2, bitsPerChannel: 32, isFloat: false).isFloat32 == false)
    }
}
