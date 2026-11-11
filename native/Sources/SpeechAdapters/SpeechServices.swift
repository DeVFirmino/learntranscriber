import SpeechCore

/// The Apple Speech operations the command answers with. The command chooses the concrete services only in
/// `main()`, so tests can drive every mode with fakes.
@MainActor
public protocol SpeechServices {
    /// Language management, or `nil` when this Mac lacks the macOS 26 speech stack.
    func languageAssets() -> (any LanguageAssetManaging)?
    /// What this Mac can recognize for `locale`, without prompting for permission.
    func capabilities(locale: String) async -> CapabilitiesResponse
    /// Prompts for Speech Recognition if needed; throws `SpeechFailure.permissionDenied` unless authorized.
    func authorize() async throws
    /// The engine that transcribes files in `locale`.
    func fileRecognizer(locale: String) async -> any FileRecognizing
    /// Live recognition for one speaker of one session, reporting to `sink`.
    func liveRecognizer(identity: SessionIdentity, sink: any SessionEventSink) throws -> any LiveRecognizing
}
