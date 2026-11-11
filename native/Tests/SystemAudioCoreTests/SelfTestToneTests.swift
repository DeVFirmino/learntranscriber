import Foundation
import Testing
@testable import SystemAudioCore

struct SelfTestToneTests {
    private let samples: [Int16] = {
        let tone = SelfTestTone.oneSecond()
        return stride(from: 0, to: tone.count, by: 2).map { offset in
            Int16(littleEndian: tone.withUnsafeBytes { $0.loadUnaligned(fromByteOffset: offset, as: Int16.self) })
        }
    }()

    @Test func isOneSecondOfHelperAudio() {
        #expect(SelfTestTone.oneSecond().count == HelperAudioFormat.bytesPerSecond)
        #expect(samples.count == HelperAudioFormat.sampleRate)
    }

    @Test func startsAtSilence() {
        #expect(samples.first == 0)
    }

    @Test func peaksJustBelowTheAmplitude() throws {
        let peak = try #require(samples.map { abs(Int($0)) }.max())
        #expect(peak <= 4_000)
        #expect(peak >= 3_990)
    }

    @Test func isAbout102Hz() {
        let signs = samples.filter { $0 != 0 }.map { $0 > 0 }
        let crossings = zip(signs, signs.dropFirst()).filter { $0 != $1 }.count
        #expect(crossings == 203, "a 102 Hz tone changes sign about 204 times a second")
    }
}
