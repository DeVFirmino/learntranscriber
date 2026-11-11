import ArgumentParser
import CommandKit
import ContextAdapters
import ContextCore
import CoreGraphics
import Foundation
import HelperKit

/// Extracts text locally for the desktop app; it sends nothing anywhere and requests no permissions.
@main
struct ContextHelper: ParsableCommand {
    static let configuration = CommandConfiguration(commandName: "context-helper", abstract: "Read selected text or recognize text in an image.")
    /// The one error line for every usage mistake: no mode, an unknown flag or a missing value.
    static let usage = "Choose --status, --selection or --image <file>."

    @Flag(help: "Report whether Accessibility access is granted.")
    var status = false

    @Flag(help: "Read the text selected in the frontmost application.")
    var selection = false

    @Option(help: "Recognize text in this image file.")
    var image: String?

    @Flag(help: "Recognize text in a built-in test image.")
    var selfTest = false

    @Option(help: "Process to ignore when reading the selection; ignored when not a number.")
    var excludePid: String?

    /// The options above that take a value; only their first occurrence counts.
    static let valuedOptions: Set<String> = ["--image", "--exclude-pid"]

    /// The process `--exclude-pid` names, or `nil` when it is absent or not a number.
    var excludedProcess: pid_t? { excludePid.flatMap(pid_t.init) }

    /// What this run answers. When several mode flags are given, the first of `--status`, `--selection`,
    /// `--image` and `--self-test` wins.
    ///
    /// - Throws: `ValidationError` carrying `usage` when no mode is given. `validate()` raises it while parsing,
    ///   so a parsed command always has a mode.
    var mode: Mode {
        get throws(ValidationError) {
            if status { return .status }
            if selection { return .selection(excluding: excludedProcess) }
            if let image { return .image(URL(filePath: image)) }
            if selfTest { return .selfTest }
            throw ValidationError(Self.usage)
        }
    }

    /// Rejects a run without a mode while parsing, so it ends on the usage line like any other usage mistake.
    func validate() throws { _ = try mode }

    /// Every outcome, including a usage mistake, is one JSON line; failures exit with 1.
    /// The concrete Apple adapters are chosen only here. It runs on the main actor because the Accessibility
    /// reader and the self-test drawing are main-actor AppKit work.
    @MainActor
    static func main() {
        do {
            let command = try parse(Array(CommandLine.arguments.dropFirst()).keepingFirstOccurrence(of: valuedOptions))
            LineWriter.write(try command.respond(
                selection: AccessibilitySelection(), recognizer: VisionTextRecognizer(), selfTestImage: SelfTestImage.render))
        } catch {
            exit(reporting: error, usage: usage) { ContextResponse(error: $0) }
        }
    }

    /// Answers the parsed mode through the given adapters.
    @MainActor
    func respond(selection reader: some SelectionReading, recognizer: some TextRecognizing,
                 selfTestImage: () throws -> CGImage) throws -> ContextResponse {
        switch try mode {
        case .status:
            return ContextResponse(trusted: reader.isTrusted)
        case .selection(let excludedProcess):
            guard let found = try reader.selection(excludingProcess: excludedProcess) else { return ContextResponse(text: "") }
            return ContextResponse(text: found.text, application: found.application)
        case .image(let url):
            return ContextResponse(text: try recognizer.text(inImageAt: url))
        case .selfTest:
            return ContextResponse(text: try recognizer.text(in: selfTestImage()))
        }
    }
}
