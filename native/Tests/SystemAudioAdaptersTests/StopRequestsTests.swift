import Foundation
import HelperKit
import Testing
@testable import SystemAudioAdapters

struct StopRequestsTests {
    private func requests(from pipe: Pipe) -> StopRequests {
        StopRequests(reader: StandardInputReader(fileDescriptor: pipe.fileHandleForReading.fileDescriptor, pollInterval: .milliseconds(10)))
    }

    @Test func yieldsOncePerStopLineAndEndsWithTheInput() async throws {
        let pipe = Pipe()
        var iterator = requests(from: pipe).makeAsyncIterator()
        pipe.fileHandleForWriting.write(Data("noise\nst".utf8))
        pipe.fileHandleForWriting.write(Data("op\n".utf8))
        #expect(try await iterator.next() != nil)
        try pipe.fileHandleForWriting.close()
        #expect(try await iterator.next() == nil)
    }

    @Test func cancellingEndsAWaitOnAnOpenSilentPipe() async {
        let pipe = Pipe()
        let stopRequests = requests(from: pipe)
        let waiting = Task {
            var iterator = stopRequests.makeAsyncIterator()
            return try await iterator.next()
        }
        try? await Task.sleep(for: .milliseconds(50))
        waiting.cancel()
        await #expect(throws: CancellationError.self) { try await waiting.value }
        // Releasing the pipe earlier would close its write end and turn the wait into the end of input.
        withExtendedLifetime(pipe) {}
    }
}
