import Foundation
import Testing
@testable import HelperKit

struct StandardInputReaderTests {
    @Test func readsChunksUntilTheWriterCloses() async throws {
        let pipe = Pipe()
        pipe.fileHandleForWriting.write(Data(repeating: 7, count: 10_000))
        try pipe.fileHandleForWriting.close()
        let reader = StandardInputReader(fileDescriptor: pipe.fileHandleForReading.fileDescriptor, chunkSize: 4096)
        var total = 0
        while case .bytes(let chunk) = try await reader.next() { total += chunk.count }
        #expect(total == 10_000)
    }

    @Test func idleIsReportedWhileThePipeStaysOpen() async throws {
        let pipe = Pipe()
        let reader = StandardInputReader(fileDescriptor: pipe.fileHandleForReading.fileDescriptor,
                                         chunkSize: 3_200, pollInterval: .milliseconds(5), idleTimeout: .milliseconds(10))
        #expect(try await reader.next() == .idle)
        pipe.fileHandleForWriting.write(Data([1, 2, 3, 4]))
        #expect(try await reader.next() == .bytes(Data([1, 2, 3, 4])))
        try pipe.fileHandleForWriting.close()
        #expect(try await reader.next() == .end)
    }

    @Test func cancellingEndsAWaitOnAnOpenSilentPipe() async {
        let pipe = Pipe()
        let reader = StandardInputReader(fileDescriptor: pipe.fileHandleForReading.fileDescriptor, pollInterval: .milliseconds(10))
        let waiting = Task { try await reader.next() }
        try? await Task.sleep(for: .milliseconds(50))
        waiting.cancel()
        await #expect(throws: CancellationError.self) { try await waiting.value }
        // Releasing the pipe earlier would close its write end and turn the wait into `.end`.
        withExtendedLifetime(pipe) {}
    }
}
