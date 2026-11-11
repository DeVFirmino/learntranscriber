import Foundation

/// Transcribes files with SpeechAnalyzer and the installed language assets.
@available(macOS 26.0, *)
struct ModernFileRecognizer: FileRecognizing {
    /// The locale every file is transcribed in.
    let locale: String

    func transcribe(fileAt url: URL) async throws -> String { try await ModernSpeech.transcribe(fileAt: url, locale: locale) }
}
