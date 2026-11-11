import Foundation
import Testing
@testable import SystemAudioCore

struct PacketBatcherTests {
    @Test func releasesAPacketOnlyOnceTheLimitIsReached() {
        var batcher = PacketBatcher(limit: 4)
        #expect(batcher.append(Data([1, 2])) == nil)
        #expect(batcher.append(Data([3, 4, 5])) == Data([1, 2, 3, 4, 5]), "a full batch is written whole, never split")
        #expect(batcher.flush() == nil)
        #expect(batcher.append(Data([6])) == nil)
        #expect(batcher.flush() == Data([6]))
    }
}
