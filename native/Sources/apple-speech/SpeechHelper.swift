import ArgumentParser
import CommandKit
import Foundation
import HelperKit
import SpeechAdapters
import SpeechCore

/// Apple Speech for the desktop app: capabilities, language assets, file transcription and live sessions.
/// Everything runs on this device; only the transcribing modes ask for the Speech Recognition permission.
@main
struct SpeechHelper: AsyncParsableCommand {
    static let configuration = CommandConfiguration(commandName: "apple-speech", abstract: "On-device speech recognition.")
    /// The one error line for every usage mistake, in both reply shapes.
    static let usage = SpeechFailure.invalidArguments.localizedDescription

    @Flag(help: "Report recognition support for --locale without prompting.")
    var capabilities = false

    @Flag(help: "List supported, installed and reserved languages.")
    var listAssets = false

    @Flag(help: "Reserve and download the language given by --locale.")
    var installLocale = false

    @Flag(help: "Release the reservation of the language given by --locale.")
    var releaseLocale = false

    @Option(help: "Audio file to transcribe.")
    var audio: String?

    @Option(help: "Locale for recognition and asset management.")
    var locale = "en-US"

    @Option(help: "\"session\" streams PCM16 from stdin and writes live events.")
    var mode: Mode?

    @Option(help: "Session id of a live stream.")
    var sessionId: String?

    @Option(help: "Language of a live stream; \"auto\" uses the system locale.")
    var language: String?

    @Option(help: "Speaker of a live stream: ME or THEY.")
    var speakerLabel: String?

    /// The options above that take a value; only their first occurrence counts.
    static let valuedOptions: Set<String> = ["--audio", "--locale", "--mode", "--session-id", "--language", "--speaker-label"]

    /// What a run without `--mode` answers. Language management wins over `--capabilities`, which wins over
    /// `--audio`; among the language flags, release wins over install, which wins over listing.
    ///
    /// - Throws: `SpeechFailure.invalidArguments` when no request is given.
    var request: Request {
        get throws(SpeechFailure) {
            if releaseLocale { return .assets(.release) }
            if installLocale { return .assets(.install) }
            if listAssets { return .assets(.list) }
            if capabilities { return .capabilities }
            guard let audio else { throw .invalidArguments }
            return .transcribe(audio: audio)
        }
    }

    /// One JSON line per outcome; failures exit with 1. Session mode reports errors as session events so the
    /// app can route them. The concrete Apple services are chosen only here.
    @MainActor
    static func main() async {
        let arguments = Array(CommandLine.arguments.dropFirst()).keepingFirstOccurrence(of: valuedOptions)
        let command: SpeechHelper
        do { command = try parse(arguments) }
        catch {
            // A malformed session command still answers as a session event, which is what the app routes.
            if exitCode(for: error) != .success, arguments.value(after: "--mode").flatMap(Mode.init(rawValue:)) == .session {
                LineWriter.write(sessionError(usage, sessionId: arguments.value(after: "--session-id"),
                                              speakerLabel: arguments.value(after: "--speaker-label")))
                Foundation.exit(1)
            }
            Self.exit(reporting: error, usage: usage) { ErrorResponse(error: $0) }
        }
        let services = AppleSpeechServices()
        if command.mode == .session {
            let input = StandardInputReader(chunkSize: SessionAudio.maximumReadBytes, idleTimeout: SpeechTimeouts.inputIdle)
            do { try await command.runSession(services: services, sink: StandardOutputSink(), nextChunk: input.next) }
            catch {
                LineWriter.write(sessionError(error.localizedDescription, sessionId: command.sessionId, speakerLabel: command.speakerLabel))
                Foundation.exit(1)
            }
            return
        }
        do { LineWriter.write(try await command.respond(services: services)) }
        catch {
            LineWriter.write(ErrorResponse(error: error.localizedDescription))
            Foundation.exit(1)
        }
    }

    /// The error line of a live session. The ids are echoed as given, empty when absent, so the app can route it.
    static func sessionError(_ message: String, sessionId: String?, speakerLabel: String?) -> SessionEvent {
        SessionEvent(kind: .error, sessionId: sessionId ?? "", speakerLabel: speakerLabel ?? "", error: message)
    }

    /// Answers the parsed request through `services`.
    ///
    /// - Throws: `SpeechFailure.invalidArguments` when there is no request or the audio file does not exist,
    ///   before any permission is asked; otherwise the failure of the service that answered.
    @MainActor
    func respond(services: some SpeechServices) async throws -> SpeechReply {
        switch try request {
        case .assets(let operation):
            guard let assets = services.languageAssets() else { return .assetManagementUnavailable }
            switch operation {
            case .list: return .assetList(await assets.list())
            case .install: return .assetInstall(try await assets.install(locale: locale))
            case .release: return .assetRelease(try await assets.release(locale: locale))
            }
        case .capabilities:
            return .capabilities(await services.capabilities(locale: locale))
        case .transcribe(let audio):
            guard FileManager.default.fileExists(atPath: audio) else { throw SpeechFailure.invalidArguments }
            try await services.authorize()
            let recognizer = await services.fileRecognizer(locale: locale)
            return .transcript(TranscriptResponse(text: try await recognizer.transcribe(fileAt: URL(filePath: audio)), locale: locale))
        }
    }

    /// Reads PCM16 chunks until the input closes, streaming events for one speaker of one session to `sink`.
    /// Each chunk is read only after the previous one was handed to the recognizer.
    ///
    /// - Throws: `SpeechFailure.invalidArguments` for a bad session id or speaker, before any permission is
    ///   asked; `SpeechFailure.malformedAudio` when the input ends in the middle of a sample; or the failure of
    ///   the input or the recognizer. The recognizer is stopped on every way out once it exists.
    @MainActor
    func runSession(services: some SpeechServices, sink: any SessionEventSink,
                    nextChunk: () async throws -> StandardInputReader.Chunk) async throws {
        let identity = try SessionIdentity(sessionId: sessionId, speakerLabel: speakerLabel, language: language)
        try await services.authorize()
        let recognizer = try services.liveRecognizer(identity: identity, sink: sink)
        recognizer.announceReady()
        do {
            var framing = SampleFraming()
            reading: while true {
                switch try await nextChunk() {
                case .end:
                    break reading
                case .idle:
                    await recognizer.inputPaused()
                case .bytes(let bytes):
                    let chunk = framing.frame(bytes)
                    if chunk.isEmpty == false { try await recognizer.append(chunk) }
                }
            }
            guard framing.hasDanglingByte == false else { throw SpeechFailure.malformedAudio }
            await recognizer.stop()
        } catch {
            await recognizer.stop()
            throw error
        }
    }
}
