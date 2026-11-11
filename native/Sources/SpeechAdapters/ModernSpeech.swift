import AVFAudio
import Foundation
import HelperKit
import Speech
import SpeechCore

/// The macOS 26 speech stack: SpeechAnalyzer recognition with installed language assets.
///
/// A requested identifier is resolved to the framework's own locale with `SpeechTranscriber.supportedLocale(equivalentTo:)`;
/// locales the framework already returned are compared with `LocaleMatching.areEquivalent(_:_:)`.
@available(macOS 26.0, *)
public enum ModernSpeech {
    /// Whether this Mac has the modern speech stack at all; language management needs it.
    public static var isAvailable: Bool { SpeechTranscriber.isAvailable }

    /// The framework's locale equivalent to `identifier`.
    ///
    /// - Throws: `SpeechFailure.unsupportedLocale` when the modern stack is missing or does not support the locale.
    static func supportedLocale(for identifier: String) async throws -> Locale {
        guard isAvailable, let locale = await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: identifier)) else {
            throw SpeechFailure.unsupportedLocale
        }
        return locale
    }

    /// The transcription module for a locale the framework supports.
    static func module(for locale: Locale) -> SpeechTranscriber {
        SpeechTranscriber(locale: locale, preset: .transcription)
    }

    /// The transcription module for `identifier`, ready to use.
    ///
    /// - Throws: `SpeechFailure.unsupportedLocale` for an unsupported locale,
    ///   `SpeechFailure.languageNotInstalled` when its assets are not on this Mac.
    static func installedModule(for identifier: String) async throws -> SpeechTranscriber {
        let module = module(for: try await supportedLocale(for: identifier))
        guard await AssetInventory.status(forModules: [module]) == .installed else { throw SpeechFailure.languageNotInstalled }
        return module
    }

    /// Whether the modern engine can transcribe `identifier` right now.
    public static func isInstalled(for identifier: String) async -> Bool {
        (try? await installedModule(for: identifier)) != nil
    }

    /// Transcribes the file at `url` with the installed assets for `identifier`; one minute at most.
    ///
    /// The analyzer is stopped on every way out: cancelling the Swift tasks alone would leave the results
    /// sequence waiting on a framework producer that only `cancelAndFinishNow()` ends.
    public static func transcribe(fileAt url: URL, locale identifier: String) async throws -> String {
        let module = try await installedModule(for: identifier)
        let results = module.results
        let analyzer = SpeechAnalyzer(modules: [module])
        let outcome: Result<String, any Error>
        do {
            outcome = .success(try await withTimeout(SpeechTimeouts.fileRecognition, failure: SpeechFailure.timedOut,
                                                     onTimeout: { await analyzer.cancelAndFinishNow() }) {
                try await withThrowingTaskGroup(of: String?.self) { group in
                    group.addTask { try await collectText(from: results) }
                    group.addTask {
                        try await analyze(file: url, with: analyzer)
                        return nil
                    }
                    var text = ""
                    for try await case let part? in group { text = part }
                    return text
                }
            })
        } catch {
            outcome = .failure(error)
        }
        await analyzer.cancelAndFinishNow()
        return try outcome.get()
    }

    /// Joins every result the transcriber reports, in order, until the analyzer finishes.
    private static func collectText(from results: some AsyncSequence<SpeechTranscriber.Result, any Error> & Sendable) async throws -> String {
        var text: [String] = []
        for try await result in results { text.append(String(result.text.characters)) }
        return text.joined(separator: " ")
    }

    /// Feeds the whole file to `analyzer` and finalizes it. A failure stops the analyzer before it is rethrown,
    /// so the results sequence ends and the task group can finish.
    private static func analyze(file url: URL, with analyzer: SpeechAnalyzer) async throws {
        do {
            let audio = try AVAudioFile(forReading: url)
            if let end = try await analyzer.analyzeSequence(from: audio) { try await analyzer.finalizeAndFinish(through: end) }
            else { try await analyzer.finalizeAndFinishThroughEndOfInput() }
        } catch {
            await analyzer.cancelAndFinishNow()
            throw error
        }
    }
}
