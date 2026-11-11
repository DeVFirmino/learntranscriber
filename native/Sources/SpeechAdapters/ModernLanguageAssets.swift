import Foundation
import Speech
import SpeechCore

/// Language management through AssetInventory, which the macOS 26 speech stack provides.
@available(macOS 26.0, *)
struct ModernLanguageAssets: LanguageAssetManaging {
    func list() async -> AssetListResponse {
        AssetListResponse(locales: await SpeechTranscriber.supportedLocales.map(\.identifier).sorted(),
                          installedLocales: await SpeechTranscriber.installedLocales.map(\.identifier).sorted(),
                          reservedLocales: await AssetInventory.reservedLocales.map(\.identifier).sorted(),
                          maximumReservedLocales: AssetInventory.maximumReservedLocales)
    }

    /// Reserves and downloads a language; a failed download releases only the reservation this call made.
    ///
    /// - Throws: `SpeechFailure.unsupportedLocale`, `SpeechFailure.languageCapacityFull` when no reservation
    ///   slot is free, `SpeechFailure.onDeviceUnavailable` when the download does not leave the language installed,
    ///   or the framework's own error.
    func install(locale identifier: String) async throws -> AssetInstallResponse {
        let locale = try await ModernSpeech.supportedLocale(for: identifier)
        let reserved = await AssetInventory.reservedLocales
        let alreadyReserved = Self.reservation(of: locale.identifier, in: reserved) != nil
        guard alreadyReserved || reserved.count < AssetInventory.maximumReservedLocales else {
            throw SpeechFailure.languageCapacityFull
        }
        if alreadyReserved == false { try await AssetInventory.reserve(locale: locale) }
        do {
            let module = ModernSpeech.module(for: locale)
            if let request = try await AssetInventory.assetInstallationRequest(supporting: [module]) {
                try await request.downloadAndInstall()
            }
            guard await AssetInventory.status(forModules: [module]) == .installed else { throw SpeechFailure.onDeviceUnavailable }
            return AssetInstallResponse(locale: locale.identifier)
        } catch {
            if alreadyReserved == false { await AssetInventory.release(reservedLocale: locale) }
            throw error
        }
    }

    /// Releases a language this app reserved.
    ///
    /// - Throws: `SpeechFailure.localeNotReserved` when the app holds no reservation for it.
    func release(locale identifier: String) async throws -> AssetReleaseResponse {
        guard let locale = Self.reservation(of: identifier, in: await AssetInventory.reservedLocales) else {
            throw SpeechFailure.localeNotReserved
        }
        let released = await AssetInventory.release(reservedLocale: locale)
        return AssetReleaseResponse(locale: locale.identifier, released: released)
    }

    /// The reserved locale equivalent to `identifier`, if the app holds one.
    private static func reservation(of identifier: String, in reserved: [Locale]) -> Locale? {
        reserved.first { LocaleMatching.areEquivalent($0.identifier, identifier) }
    }
}
