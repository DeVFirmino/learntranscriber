import ArgumentParser
import Foundation
import HelperKit

/// How every helper command ends when it cannot answer normally: `--help` prints the help and exits 0;
/// a usage mistake or any failure becomes one JSON error line on stdout and exit status 1, which is what
/// the desktop app expects from the helpers.
extension ParsableCommand {
    /// Ends the process reporting `error`. A help request prints the help text and exits 0. A usage mistake
    /// reports `usage`, any other error its description; `errorLine` wraps that message in the JSON line
    /// written before exiting 1.
    public static func exit<Line: Encodable>(reporting error: any Error, usage: String, errorLine: (String) -> Line) -> Never {
        let code = exitCode(for: error)
        if code == .success {
            print(fullMessage(for: error))
            Foundation.exit(0)
        }
        LineWriter.write(errorLine(code == .validationFailure ? usage : error.localizedDescription))
        Foundation.exit(1)
    }
}
