import SpeechCore

/// Lists, installs and releases the language assets of the modern speech stack.
public protocol LanguageAssetManaging: Sendable {
    /// The supported, installed and reserved languages.
    func list() async -> AssetListResponse
    /// Reserves and downloads the language `locale` names.
    func install(locale: String) async throws -> AssetInstallResponse
    /// Releases the app's reservation of the language `locale` names.
    func release(locale: String) async throws -> AssetReleaseResponse
}
