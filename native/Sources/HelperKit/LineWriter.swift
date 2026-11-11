import Foundation

/// Writes one JSON object per line to standard output, the protocol the desktop app reads.
public enum LineWriter {
    /// Encodes `value` as a single line of JSON with sorted keys and writes it to stdout.
    ///
    /// Every reply type is encodable by construction, so a line that cannot be encoded is a programming
    /// error the protocol has no way to express. A failed write means stdout itself is gone (the app
    /// closed its end); the exit status is the only channel left, so the helper ends with 1 instead of
    /// carrying on as if the line had been delivered.
    ///
    /// Lines are not serialized here. Each helper writes from one isolation domain (the main actor), so lines
    /// never interleave; the type is not `@MainActor` because the shared command ending and the speech
    /// command's entry point write from nonisolated code.
    public static func write(_ value: some Encodable) {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        var line: Data
        do { line = try encoder.encode(value) }
        catch { preconditionFailure("A protocol line could not be encoded: \(error)") }
        line.append(0x0A)
        do { try FileHandle.standardOutput.write(contentsOf: line) }
        catch { exit(EXIT_FAILURE) }
    }
}
