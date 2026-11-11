import Testing
@testable import SystemAudioCore

struct CaptureOptionsTests {
    @Test func livePacketsAreATenthOfASecondAndSegmentsEightSeconds() {
        #expect(CaptureOptions(excludedBundleID: "x", livePackets: true).packetBytes == 3_200)
        #expect(CaptureOptions(excludedBundleID: "x").packetBytes == 256_000)
    }
}
