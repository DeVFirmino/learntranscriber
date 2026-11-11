import ArgumentParser
import CommandKit
import HelperKit
import Testing

/// Exit tests: each body runs in a child process, so the real exit status and stdout are observed.
struct CommandEndingTests {
    private struct Probe: ParsableCommand {
        static let configuration = CommandConfiguration(commandName: "probe")
        func run() {}
    }

    @Test func aUsageMistakeReportsTheUsageAndExits1() async {
        let result = await #expect(processExitsWith: .exitCode(1), observing: [\.standardOutputContent]) {
            Probe.exit(reporting: ValidationError("missing"), usage: "Choose a mode.") { ["error": $0] }
        }
        #expect(result?.standardOutputContent == Array("{\"error\":\"Choose a mode.\"}\n".utf8))
    }

    @Test func anyOtherFailureReportsItsDescriptionAndExits1() async {
        let result = await #expect(processExitsWith: .exitCode(1), observing: [\.standardOutputContent]) {
            Probe.exit(reporting: HelperError("No display is connected."), usage: "Choose a mode.") { ["error": $0] }
        }
        #expect(result?.standardOutputContent == Array("{\"error\":\"No display is connected.\"}\n".utf8))
    }

    @Test func aHelpRequestPrintsTheHelpAndExits0() async {
        let result = await #expect(processExitsWith: .success, observing: [\.standardOutputContent]) {
            Probe.exit(reporting: CleanExit.helpRequest(), usage: "Choose a mode.") { ["error": $0] }
        }
        let output = result.map { String(decoding: $0.standardOutputContent, as: UTF8.self) } ?? ""
        #expect(output.contains("USAGE: probe"))
    }
}
