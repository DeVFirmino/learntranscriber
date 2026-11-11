import SpeechCore

/// The services backed by the Speech framework on this Mac.
@MainActor
public struct AppleSpeechServices: SpeechServices {
    /// Creates the services; nothing is asked of the system until a method runs.
    public init() {}

    public func languageAssets() -> (any LanguageAssetManaging)? {
        guard #available(macOS 26.0, *), ModernSpeech.isAvailable else { return nil }
        return ModernLanguageAssets()
    }

    public func capabilities(locale: String) async -> CapabilitiesResponse { await SpeechCapabilities.query(locale: locale) }

    public func authorize() async throws { try await SpeechAuthorization.require() }

    public func fileRecognizer(locale: String) async -> any FileRecognizing { await FileRecognizers.preferred(locale: locale) }

    public func liveRecognizer(identity: SessionIdentity, sink: any SessionEventSink) throws -> any LiveRecognizing {
        try StreamingRecognizer(identity: identity, sink: sink)
    }
}
