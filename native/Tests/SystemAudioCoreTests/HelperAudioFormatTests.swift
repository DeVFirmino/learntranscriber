import Testing
@testable import SystemAudioCore

struct HelperAudioFormatTests {
    @Test func oneSecondIs32000BytesOfPCM16() {
        #expect(HelperAudioFormat.bytesPerSecond == 32_000)
    }

    @Test(arguments: [
        (Duration.zero, 0),
        (.milliseconds(100), 3_200),
        (.seconds(1), 32_000),
        (.seconds(8), 256_000),
    ])
    func byteCountCoversWholeFrames(duration: Duration, bytes: Int) {
        #expect(HelperAudioFormat.byteCount(for: duration) == bytes)
    }
}
