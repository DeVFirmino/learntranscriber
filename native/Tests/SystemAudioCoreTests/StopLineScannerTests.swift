import Testing
@testable import SystemAudioCore

struct StopLineScannerTests {
    @Test(arguments: [
        (["stop\n"], true),
        (["st", "op\n"], true),
        (["stop\r\n"], true),
        (["stop\r"], true),
        (["\n\nstop\n"], true),
        (["noise\nstop\n"], true),
        (["stopstop\n", "stop\n"], true),
        (["stop"], false),
        (["stopped\n"], false),
        (["xstop\n"], false),
        (["STOP\n"], false),
    ])
    func findsOnlyACompleteStopLine(chunks: [String], isRequest: Bool) {
        var scanner = StopLineScanner()
        let found = chunks.contains { scanner.scan($0.utf8) }
        #expect(found == isRequest)
    }
}
